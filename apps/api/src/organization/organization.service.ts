import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../database/database.module';
import { AccessService, type Actor } from '../access/access';
import { codeSchema, idSchema, nameSchema, validate } from '../common/validation';
import { entityQuerySchema, locationQuerySchema, locationWhere } from './organization.queries';

const fieldError = (field: string, message: string) => ({ message, issues: [{ field, message }] });

export const entitySchema = z.object({ code: codeSchema, name: nameSchema }).strict();
export const locationSchema = z
  .object({
    code: codeSchema,
    name: nameSchema,
    entityId: idSchema,
    type: z.enum(['CENTER', 'DC', 'STAND']),
    ownership: z.enum(['OWNED', 'PARTNER']).default('OWNED'),
    parentId: idSchema.nullable().default(null),
  })
  .strict();

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async locations(actor: Actor) {
    if (actor.role !== 'CENTRAL_ADMIN' && !actor.locationId) return [];
    const where =
      actor.role === 'CENTRAL_ADMIN'
        ? {}
        : actor.role === 'DC_ADMIN'
          ? { OR: [{ id: actor.locationId ?? '' }, { parentId: actor.locationId ?? '' }] }
          : { id: actor.locationId ?? '' };
    return this.db.location.findMany({
      where,
      include: { entity: true },
      orderBy: { code: 'asc' },
      take: 500,
    });
  }

  entities(actor: Actor) {
    this.access.requireCentral(actor);
    return this.db.legalEntity.findMany({ orderBy: { name: 'asc' }, take: 500 });
  }

  async pagedLocations(actor: Actor, input: unknown) {
    const query = validate(locationQuerySchema, input);
    const where = locationWhere(actor, query);
    const [items, total] = await this.db.$transaction([
      this.db.location.findMany({
        where,
        include: {
          entity: true,
          parent: { select: { id: true, name: true, code: true, type: true } },
          _count: { select: { children: true } },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.db.location.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.ceil(total / query.perPage),
    };
  }

  async pagedEntities(actor: Actor, input: unknown) {
    this.access.requireCentral(actor);
    const query = validate(entityQuerySchema, input);
    const where = {
      ...(query.excludeEntityId ? { id: { not: query.excludeEntityId } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { code: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.legalEntity.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.db.legalEntity.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.ceil(total / query.perPage),
    };
  }

  async createEntity(actor: Actor, body: unknown) {
    this.access.requireCentral(actor);
    const data = validate(entitySchema, body);
    return this.db
      .$transaction(async (tx) => {
        const entity = await tx.legalEntity.create({ data });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            action: 'entity.created',
            subjectId: entity.id,
            details: data,
          },
        });
        return entity;
      })
      .catch((error: unknown) => {
        if ((error as { code?: string })?.code === 'P2002')
          throw new ConflictException(
            fieldError('code', 'Kode pemilik usaha ini sudah digunakan. Gunakan kode lain.'),
          );
        throw error;
      });
  }

  async createLocation(actor: Actor, body: unknown) {
    this.access.requireCentral(actor);
    const data = validate(locationSchema, body);
    const entity = await this.db.legalEntity.findUnique({ where: { id: data.entityId } });
    if (!entity)
      throw new BadRequestException(fieldError('entityId', 'Pilih pemilik usaha yang tersedia.'));
    const parent = data.parentId
      ? await this.db.location.findUnique({ where: { id: data.parentId } })
      : null;
    if (data.type === 'CENTER') {
      if (data.parentId || data.ownership !== 'OWNED')
        throw new BadRequestException(
          fieldError('parentId', 'Pusat tidak memiliki lokasi induk dan bukan mitra.'),
        );
    } else {
      if (!parent || parent.type !== (data.type === 'DC' ? 'CENTER' : 'DC')) {
        throw new BadRequestException(
          fieldError(
            'parentId',
            data.type === 'DC'
              ? 'Pilih pusat yang membawahi DC ini.'
              : 'Pilih DC yang menangani stand ini.',
          ),
        );
      }
      if (data.ownership === 'PARTNER' && data.type !== 'STAND')
        throw new BadRequestException(
          fieldError('ownership', 'Kepemilikan mitra hanya untuk stand.'),
        );
      if (data.ownership === 'OWNED' && parent.entityId !== data.entityId)
        throw new BadRequestException(
          fieldError(
            'entityId',
            'Lokasi milik sendiri harus mengikuti pemilik usaha lokasi induk.',
          ),
        );
      if (data.ownership === 'PARTNER' && parent.entityId === data.entityId)
        throw new BadRequestException(
          fieldError('entityId', 'Pilih pemilik mitra yang berbeda dari pemilik DC.'),
        );
    }
    return this.db
      .$transaction(async (tx) => {
        const location = await tx.location.create({ data });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            action: 'location.created',
            subjectId: location.id,
            details: data,
          },
        });
        return location;
      })
      .catch((error: unknown) => {
        if ((error as { code?: string })?.code === 'P2002')
          throw new ConflictException(
            fieldError('code', 'Kode lokasi ini sudah digunakan. Gunakan kode lain.'),
          );
        throw error;
      });
  }

  async scopedLocation(actor: Actor, id: string) {
    const location = await this.db.location.findUnique({ where: { id: validate(idSchema, id) } });
    if (!location) throw new NotFoundException('Lokasi tidak ditemukan.');
    this.access.requireLocation(actor, location);
    return location;
  }

  async locationDetail(actor: Actor, id: string) {
    // Authorize before including/counting related records.
    await this.scopedLocation(actor, id);
    return this.db.location.findUniqueOrThrow({
      where: { id },
      include: {
        entity: true,
        parent: { select: { id: true, name: true, code: true, type: true } },
        _count: { select: { children: true } },
      },
    });
  }
}

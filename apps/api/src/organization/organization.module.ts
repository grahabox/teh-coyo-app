import { Body, Controller, Get, Inject, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../access/access';
import { CurrentActor } from '../auth/auth.decorators';
import { OrganizationService } from './organization.service';

@ApiTags('Organization')
@ApiBearerAuth()
@Controller()
class OrganizationController {
  constructor(@Inject(OrganizationService) private readonly service: OrganizationService) {}
  @Get('locations') locations(@CurrentActor() actor: Actor) {
    return this.service.locations(actor);
  }
  @Get('locations/page')
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: ['CENTER', 'DC', 'STAND'] })
  @ApiQuery({ name: 'ownership', required: false, enum: ['OWNED', 'PARTNER'] })
  @ApiQuery({ name: 'parentId', required: false, type: String })
  pagedLocations(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.service.pagedLocations(actor, query);
  }
  @Get('locations/:id/detail')
  detail(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.service.locationDetail(actor, id);
  }
  @Get('locations/:id') location(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.service.scopedLocation(actor, id);
  }
  @Get('entities') entities(@CurrentActor() actor: Actor) {
    return this.service.entities(actor);
  }
  @Get('entities/page')
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({ name: 'excludeEntityId', required: false, type: String })
  pagedEntities(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.service.pagedEntities(actor, query);
  }
  @Post('entities')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code', 'name'],
      properties: { code: { type: 'string' }, name: { type: 'string' } },
    },
  })
  entity(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.service.createEntity(actor, body);
  }
  @Post('locations')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['code', 'name', 'entityId', 'type'],
      properties: {
        code: { type: 'string' },
        name: { type: 'string' },
        entityId: { type: 'string', format: 'uuid' },
        type: { type: 'string', enum: ['CENTER', 'DC', 'STAND'] },
        ownership: { type: 'string', enum: ['OWNED', 'PARTNER'] },
        parentId: { type: 'string', format: 'uuid', nullable: true },
      },
    },
  })
  createLocation(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.service.createLocation(actor, body);
  }
}

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}

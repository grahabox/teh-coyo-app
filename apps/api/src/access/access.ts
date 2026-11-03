import { ForbiddenException, Injectable } from '@nestjs/common';

export type AppRole = 'CENTRAL_ADMIN' | 'DC_ADMIN' | 'STAND_CASHIER' | 'PARTNER_ADMIN';
export interface Actor {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  locationId: string | null;
  sessionId: string;
}
export interface ScopedLocation {
  id: string;
  parentId: string | null;
}

export function canAccessLocation(actor: Actor, location: ScopedLocation): boolean {
  if (actor.role === 'CENTRAL_ADMIN') return true;
  if (!actor.locationId) return false;
  return (
    location.id === actor.locationId ||
    (actor.role === 'DC_ADMIN' && location.parentId === actor.locationId)
  );
}

@Injectable()
export class AccessService {
  requireCentral(actor: Actor) {
    if (actor.role !== 'CENTRAL_ADMIN') throw new ForbiddenException('Hanya admin pusat.');
  }
  requireLocation(actor: Actor, location: ScopedLocation) {
    if (!canAccessLocation(actor, location)) throw new ForbiddenException('Di luar cakupan akses.');
  }
  requireRecipeWriter(actor: Actor, scopeLocationId: string | null) {
    if (actor.role === 'CENTRAL_ADMIN') return;
    if (actor.role !== 'DC_ADMIN' || !actor.locationId || scopeLocationId !== actor.locationId) {
      throw new ForbiddenException(
        'Resep hanya dapat dibuat pusat atau admin DC untuk DC sendiri.',
      );
    }
  }
}

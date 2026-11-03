import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.module';
import { z } from 'zod';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization as string | undefined;
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException('Silakan masuk.');
    let claims: { sub: string; sid: string };
    try {
      claims = await this.jwt.verifyAsync(authorization.slice(7), { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Sesi berakhir. Silakan masuk kembali.');
    }
    if (!z.uuid().safeParse(claims.sub).success || !z.uuid().safeParse(claims.sid).success)
      throw new UnauthorizedException();
    const session = await this.db.authSession.findUnique({
      where: { id: claims.sid },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.active
    )
      throw new UnauthorizedException();
    const user = session.user;
    request.actor = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      locationId: user.locationId,
      sessionId: session.id,
    };
    return true;
  }
}

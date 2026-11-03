import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.module';
import { hashPassword, verifyPassword } from './password';
import type { User } from '../generated/prisma/client';

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const dummyHash = hashPassword(randomBytes(32).toString('hex'));

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  private async response(user: User, sessionId: string, refreshToken: string) {
    return {
      refreshToken,
      accessToken: await this.jwt.signAsync({ sub: user.id, sid: sessionId }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        locationId: user.locationId,
      },
    };
  }

  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({ where: { email: email.toLowerCase() } });
    const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
    if (!user?.active || !valid)
      throw new UnauthorizedException('Email atau password tidak sesuai.');
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.db.authSession.create({
      data: {
        userId: user.id,
        refreshHash: tokenHash(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return this.response(user, session.id, refreshToken);
  }

  async refresh(token: string | undefined) {
    if (!token || token.length > 200) throw new UnauthorizedException('Silakan masuk.');
    const existing = await this.db.authSession.findUnique({
      where: { refreshHash: tokenHash(token) },
      include: { user: true },
    });
    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt <= new Date() ||
      !existing.user.active
    ) {
      throw new UnauthorizedException('Sesi berakhir.');
    }
    const next = randomBytes(48).toString('base64url');
    // Conditional rotation prevents two requests from successfully using the same refresh token.
    const result = await this.db.authSession.updateMany({
      where: { id: existing.id, refreshHash: tokenHash(token), revokedAt: null },
      data: { refreshHash: tokenHash(next) },
    });
    if (result.count !== 1) throw new UnauthorizedException('Sesi sudah diperbarui.');
    return this.response(existing.user, existing.id, next);
  }

  async logout(token: string | undefined) {
    if (token && token.length <= 200)
      await this.db.authSession.updateMany({
        where: { refreshHash: tokenHash(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
  }
}

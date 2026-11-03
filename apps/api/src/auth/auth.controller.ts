import { Body, Controller, Get, Inject, Post, Req, Res, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getConfig } from '../common/config';
import { validate } from '../common/validation';
import type { Actor } from '../access/access';
import { CurrentActor, Public } from './auth.decorators';
import { AuthService } from './auth.service';

const cookieName = 'tc_refresh';
const cookieOptions = () => ({
  httpOnly: true,
  secure: getConfig().NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
const checkOrigin = (request: Request) => {
  if (request.headers.origin !== new URL(getConfig().APP_ORIGIN).origin) {
    throw new ForbiddenException('Origin tidak diizinkan.');
  }
};

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', format: 'password' },
      },
    },
  })
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    checkOrigin(req);
    const data = validate(
      z.object({ email: z.email().max(200), password: z.string().min(1).max(200) }).strict(),
      body,
    );
    const result = await this.auth.login(data.email, data.password);
    res.cookie(cookieName, result.refreshToken, cookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    checkOrigin(req);
    const result = await this.auth.refresh(req.cookies?.[cookieName]);
    res.cookie(cookieName, result.refreshToken, cookieOptions());
    res.setHeader('Cache-Control', 'no-store');
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    checkOrigin(req);
    await this.auth.logout(req.cookies?.[cookieName]);
    res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth()
  me(@CurrentActor() actor: Actor) {
    return actor;
  }
}

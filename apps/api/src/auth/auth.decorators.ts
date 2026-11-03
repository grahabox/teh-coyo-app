import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Actor } from '../access/access';

export const Public = () => SetMetadata('public', true);
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => context.switchToHttp().getRequest().actor,
);

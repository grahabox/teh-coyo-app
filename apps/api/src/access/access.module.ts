import { Global, Module } from '@nestjs/common';
import { AccessService } from './access';

@Global()
@Module({ providers: [AccessService], exports: [AccessService] })
export class AccessModule {}

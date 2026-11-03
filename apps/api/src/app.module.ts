import { Controller, Get, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule, DatabaseService } from './database/database.module';
import { AccessModule } from './access/access.module';
import { AuthModule } from './auth/auth.module';
import { Public } from './auth/auth.decorators';
import { OrganizationModule } from './organization/organization.module';
import { CatalogModule } from './catalog/catalog.module';
import { RecipesModule } from './recipes/recipes.module';
import { InventoryModule } from './inventory/inventory.module';
import { ProcurementModule } from './procurement/procurement.module';

@Controller('health')
class HealthController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  @Public()
  @Get()
  async check() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok', stage: 'foundation' };
    } catch {
      throw new ServiceUnavailableException('Database tidak tersedia.');
    }
  }
}

@Module({
  imports: [
    DatabaseModule,
    AccessModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    AuthModule,
    OrganizationModule,
    CatalogModule,
    RecipesModule,
    InventoryModule,
    ProcurementModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

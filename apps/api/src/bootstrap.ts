import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getConfig } from './common/config';
import { ApiErrorFilter } from './common/api-error.filter';

export async function createApp() {
  const config = getConfig();
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: new URL(config.APP_ORIGIN).origin, credentials: true });
  app.useGlobalFilters(new ApiErrorFilter());
  app.use(
    (
      _req: unknown,
      res: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
  );
  if (config.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Teh Coyo Foundation API')
        .setDescription(
          'Scoped masters, draft recipes, quantity inventory and supplier invoices/actual receipts/declared payments. No cash-bank ledger, actual production, POS, inventory valuation, tax or QRIS yet.',
        )
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/openapi.json' });
  }
  app.enableShutdownHooks();
  return app;
}

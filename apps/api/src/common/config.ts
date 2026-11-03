import 'dotenv/config';
import { z } from 'zod';
import { databaseUrlSchema, parseEnvironment } from './environment';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: databaseUrlSchema,
  JWT_SECRET: z
    .string({ error: 'Wajib diisi dengan secret acak minimal 32 karakter.' })
    .min(32, 'Secret minimal 32 karakter.'),
});

export function getConfig() {
  const config = parseEnvironment(schema, process.env);
  if (config.NODE_ENV === 'production' && !config.APP_ORIGIN.startsWith('https://')) {
    throw new Error('APP_ORIGIN must use HTTPS in production.');
  }
  return config;
}

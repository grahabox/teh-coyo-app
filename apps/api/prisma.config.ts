import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { readDatabaseUrl } from './src/common/environment';

// Code generation/schema checks need no database. Migration commands must fail
// before connecting if configuration is absent; never silently use a fake URL.
const connectionless = ['generate', 'validate', 'format'].includes(process.argv[2] ?? '');
const url =
  connectionless && process.env.DATABASE_URL === undefined ? undefined : readDatabaseUrl();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(url === undefined ? {} : { datasource: { url } }),
});

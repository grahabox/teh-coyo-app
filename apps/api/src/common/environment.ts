import { z } from 'zod';

const envHelp =
  'Isi apps/api/.env dari apps/api/.env.example, atau set variabel environment pada proses. ' +
  'File .env root untuk Docker Compose bukan pengganti konfigurasi API.';

export class EnvironmentConfigurationError extends Error {
  constructor(issues: z.core.$ZodIssue[]) {
    // Report field names and validation messages only, never raw env values.
    const fields = issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`).join('\n');
    super(`Konfigurasi environment API belum lengkap atau tidak valid:\n${fields}\n${envHelp}`);
    this.name = 'EnvironmentConfigurationError';
  }
}

export function parseEnvironment<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new EnvironmentConfigurationError(result.error.issues);
  return result.data;
}

export const databaseUrlSchema = z
  .string({ error: 'Wajib diisi dengan URL PostgreSQL.' })
  .trim()
  .min(1, 'Wajib diisi dengan URL PostgreSQL.')
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ['postgresql:', 'postgres:'].includes(url.protocol) &&
        Boolean(url.hostname) &&
        url.pathname.length > 1
      );
    } catch {
      return false;
    }
  }, 'Gunakan URL postgresql://USER:PASSWORD@HOST:PORT/NAMA_DATABASE yang valid.');

export function readDatabaseUrl(input: NodeJS.ProcessEnv = process.env) {
  return parseEnvironment(z.object({ DATABASE_URL: databaseUrlSchema }), input).DATABASE_URL;
}

export function readSeedEnvironment(input: NodeJS.ProcessEnv = process.env) {
  return parseEnvironment(
    z.object({
      DATABASE_URL: databaseUrlSchema,
      SEED_ADMIN_EMAIL: z.email({ error: 'Wajib diisi dengan alamat email admin yang valid.' }),
      SEED_ADMIN_PASSWORD: z
        .string({ error: 'Wajib diisi dengan password admin 12–200 karakter.' })
        .min(12, 'Password admin minimal 12 karakter.')
        .max(200, 'Password admin maksimal 200 karakter.'),
    }),
    input,
  );
}

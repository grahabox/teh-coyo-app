import 'reflect-metadata';
import { createApp } from './bootstrap';
import { getConfig } from './common/config';
import { EnvironmentConfigurationError } from './common/environment';

async function main() {
  const app = await createApp();
  await app.listen(getConfig().PORT, '0.0.0.0');
}
main().catch((error: unknown) => {
  console.error(
    error instanceof EnvironmentConfigurationError
      ? error.message
      : 'API gagal dimulai. Periksa konfigurasi dan koneksi database.',
  );
  process.exitCode = 1;
});

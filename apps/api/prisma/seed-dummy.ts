import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  databaseUrlSchema,
  EnvironmentConfigurationError,
  parseEnvironment,
} from '../src/common/environment';
import { requireDummyDevelopment, seedDummyData } from './dummy-seeder';

async function main() {
  const env = parseEnvironment(
    z.object({
      DATABASE_URL: databaseUrlSchema,
      NODE_ENV: z.enum(['development', 'test', 'production']),
      SEED_ADMIN_EMAIL: z.email(),
    }),
    process.env,
  );
  requireDummyDevelopment({
    nodeEnv: env.NODE_ENV,
    databaseUrl: env.DATABASE_URL,
    confirmed: process.argv.includes('--confirm-development-data'),
  });
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  try {
    const actor = await db.user.findUnique({
      where: { email: env.SEED_ADMIN_EMAIL.toLowerCase() },
    });
    if (!actor?.active || actor.role !== 'CENTRAL_ADMIN')
      throw new Error(
        'Admin pusat seed belum tersedia. Jalankan db:seed dahulu; password existing tidak akan diganti.',
      );
    const url = new URL(env.DATABASE_URL);
    console.log(
      `Menambahkan dummy ke database development ${url.hostname}:${url.port || '5432'}/${url.pathname.slice(1)}. Tanpa overwrite atau transaksi operasional.`,
    );
    console.log(JSON.stringify(await seedDummyData(db, actor.id), null, 2));
    console.log(
      'Semua resep adalah DRAFT dengan angka ilustrasi, bukan SOP. Tidak membuat saldo stok, penjualan, harga, pajak, atau akun baru.',
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  const code = (error as { code?: string })?.code;
  console.error(
    error instanceof EnvironmentConfigurationError
      ? error.message
      : code === 'P2002'
        ? 'Kode/ID dummy bertabrakan dengan data existing. Seluruh run dibatalkan; tidak ada data existing ditimpa.'
        : error instanceof Error && !code && error.name === 'Error'
          ? error.message
          : 'Dummy seed gagal. Tidak menampilkan nilai secret; periksa koneksi, migrasi, dan konfigurasi development.',
  );
  process.exitCode = 1;
});

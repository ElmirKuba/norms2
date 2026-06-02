import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

// Этот файл — конфиг CLI drizzle-kit, живёт вне src и не линтится (см. eslint
// ignores). Запускается на хосте, поэтому переменные берём из корневого .env.
dotenv.config({ path: resolve(__dirname, '..', '.env') });

export default defineConfig({
  schema: './src/database/schemas/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USER ?? 'norms2',
    password: process.env.DB_PASSWORD ?? 'norms2',
    database: process.env.DB_NAME ?? 'norms2',
    ssl: false,
  },
});

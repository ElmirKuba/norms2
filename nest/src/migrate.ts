import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/**
 * Программный мигратор для прода (ADR-0030, D1.2). Запускается ОТДЕЛЬНЫМ one-shot
 * шагом ДО старта nest: `drizzle-kit` — devDependency, в рантайм-образе его нет, а
 * `migrate()` берётся из `drizzle-orm` (прод-зависимость). Накатывает все ещё не
 * применённые миграции из `./drizzle` (журнал `meta/_journal.json` + `.sql`) и
 * выходит; идемпотентно (нет новых — no-op). Конфиг БД — из env (как
 * `drizzle.config.ts`: это deploy-tool, не сам app; env приходит из `.env`/compose).
 * @returns Промис, завершающийся после применения миграций.
 */
async function runMigrations(): Promise<void> {
  const pool = new Pool({
    host: process.env['DB_HOST'] ?? 'localhost',
    port: Number(process.env['DB_PORT'] ?? '5432'),
    user: process.env['DB_USER'] ?? 'norms2',
    password: process.env['DB_PASSWORD'] ?? 'norms2',
    database: process.env['DB_NAME'] ?? 'norms2',
  });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
  await pool.end();
}

runMigrations()
  .then(() => {
    // eslint-disable-next-line no-console -- deploy-tool, не app: пишем в stdout.
    console.log('Миграции применены.');
    process.exit(0);
  })
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console -- deploy-tool: ошибку — в stderr.
    console.error('Ошибка применения миграций:', error);
    process.exit(1);
  });

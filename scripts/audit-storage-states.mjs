#!/usr/bin/env node
/**
 * Детектор состояний хранения (2.9.3·20, ADR-0068).
 *
 * Отвечает на один вопрос: **есть ли у каждого состояния «спрятано» выход обратно и экран, где
 * его видно.** До 2.9.3 ответ был «нет» сразу у четырёх списков «Акцента»: «убрать из списка»
 * существовало, вернуть — нечем, а строка тихо жила в базе. Компилятор такое не ловит, тесты на
 * домен — тоже: каждый слой вёл себя правильно, дефект жил на стыке.
 *
 * Что проверяется:
 * 1. у таблицы со скрытием (`is_active`) есть маршруты `/:id/archive` и `/:id/restore` на бэке;
 * 2. фронт умеет их звать и умеет спросить архив (`filter: 'archived'`);
 * 3. чтения мягких таблиц не остаются без условия живости — `.from(<таблица>)` без `.where(`
 *    в репозиториях (ровно так удалённый релиз продолжал показываться в витрине).
 *
 * Инструмент сигнальный: он показывает, куда смотреть. Решение — за человеком.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCHEMAS = join(ROOT, 'nest/src/database/schemas');
const REPOSITORIES = join(ROOT, 'nest/src/database/repositories');
const MODULES = join(ROOT, 'nest/src/modules');
const ANGULAR = join(ROOT, 'angular/src/app');

/** Справочники: `is_active` там про каталог, а не про то, что человек спрятал. */
const CATALOGS = ['accent_domains', 'accent_attributes'];

/** Сопоставление таблицы с путём API — по нему ищутся маршруты и вызовы фронта. */
const API_PATHS = {
  anti_habits: 'anti-habits',
  obstacles: 'obstacles',
  micro_wins: 'micro-wins',
  habits: 'habits',
};

/**
 * Все файлы дерева с нужным расширением.
 * @param {string} dir Корень обхода.
 * @param {string} ext Расширение.
 * @returns {string[]} Пути файлов.
 */
function walk(dir, ext) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(path, ext));
    } else if (entry.name.endsWith(ext)) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Читает файл целиком.
 * @param {string} path Путь.
 * @returns {string} Содержимое.
 */
const read = (path) => readFileSync(path, 'utf8');

const problems = [];

// ---- 1-2. состояние «спрятано» без выхода ------------------------------------------------
const hidden = [];
for (const file of walk(SCHEMAS, '.schema.ts')) {
  const text = read(file);
  const name = /\(\)\(\s*'([^']+)'/.exec(text)?.[1];
  if (name && text.includes("boolean('is_active')") && !CATALOGS.includes(name)) {
    hidden.push(name);
  }
}

const backend = walk(MODULES, '.controller.ts').map(read).join('\n');
const frontend = walk(ANGULAR, '.ts').map(read).join('\n');

for (const table of hidden) {
  const path = API_PATHS[table];
  if (path === undefined) {
    problems.push(`${table}: скрытие есть, но путь API не описан в детекторе — дополнить`);
    continue;
  }
  if (!backend.includes(`${path}/:id/archive`) || !backend.includes(`${path}/:id/restore`)) {
    problems.push(`${table}: нет пары маршрутов ${path}/:id/archive и /restore — вход без выхода`);
  }
  if (!frontend.includes(`${path}/\${id}/archive`) || !frontend.includes(`${path}/\${id}/restore`)) {
    problems.push(`${table}: фронт не умеет убрать в архив и вернуть — экрана возврата нет`);
  }
}
if (!frontend.includes("filter: 'archived'")) {
  problems.push('фронт нигде не спрашивает архив (`filter: archived`) — значит и не показывает');
}

// ---- 3. чтения мягких таблиц без условия живости -------------------------------------------
const SOFT = [
  'releases',
  'notifications',
  'telegramRequests',
  'habits',
  'microWins',
  'goals',
  'goalEntries',
  'milestones',
  'antiHabits',
  'obstacles',
  'counterplays',
];
for (const file of walk(REPOSITORIES, '.ts')) {
  const text = read(file);
  for (const table of SOFT) {
    const anchor = `.from(${table})`;
    let at = text.indexOf(anchor);
    while (at >= 0) {
      const end = text.indexOf(';', at);
      const statement = text.slice(at, end < 0 ? text.length : end);
      if (!statement.includes('.where(')) {
        const line = text.slice(0, at).split('\n').length;
        problems.push(`${file.replace(ROOT, '')}:${line} — чтение ${table} без where: удалённое просочится`);
      }
      at = text.indexOf(anchor, at + anchor.length);
    }
  }
}

// ---- отчёт ---------------------------------------------------------------------------------
console.log(`Состояний со скрытием: ${hidden.length} (${hidden.join(', ')})`);
if (problems.length === 0) {
  console.log('\n✅ У каждого состояния есть выход, и ни одно чтение мягкой таблицы не осталось без фильтра.');
  process.exit(0);
}
console.log(`\n⚠️  Находок — ${problems.length}:\n`);
for (const problem of problems) {
  console.log(`  ${problem}`);
}
console.log('\nЭто сигнал, а не приговор. По каждой: где человек это увидит и как вернёт?');
process.exit(1);

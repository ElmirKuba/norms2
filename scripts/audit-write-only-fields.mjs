#!/usr/bin/env node
/**
 * Детектор «полей без потребителя» (write-only fields).
 *
 * Ловит класс дефектов, который трижды нашёлся вручную в 2.7.2: поле есть в проекции наружу
 * (`*View`), человек его заполняет — а **ни один экран его не показывает**. Компилятор такое не
 * видит: типы сходятся, сборка зелёная, просто экран молчит. `tsc` тем более бесполезен — он
 * вообще не проверяет шаблоны Angular.
 *
 * Как работает (намеренно тупо и без AST): собирает имена полей из `*-view.interface.ts` бэка и
 * ищет каждое имя в коде фич фронта, **исключая зеркало типов** `accent.types.ts` — объявление
 * типа потреблением не считается. Ноль вхождений → поле в отчёте.
 *
 * Инструмент **сигнальный, а не доказательный**: он показывает, куда посмотреть, а решает человек.
 * Ложные срабатывания нормальны (поле уехало на фронт внутри целого объекта, названо иначе,
 * ждёт будущего этапа) — для честных случаев есть `ALLOW` ниже, с причиной у каждой строки.
 *
 * Запуск: `node scripts/audit-write-only-fields.mjs` (или `make audit-fields`).
 * Код возврата: 0 — чисто, 1 — есть находки (годится для гейта перед закрытием подфазы).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACK = join(ROOT, 'nest/src/modules/accent');
const FRONT = join(ROOT, 'angular/src/app/features/accent');
/** Зеркало типов: объявление поля здесь — не потребление. */
const TYPES_MIRROR = 'accent.types.ts';

/**
 * Поля, у которых потребителя быть и не должно, — с причиной. Причина обязательна: строка без
 * объяснения превращает список в свалку, где прячутся настоящие дыры.
 */
const ALLOW = new Map([
  ['id', 'служебный идентификатор, ходит внутри объектов'],
  ['createdAt', 'техническая метка времени'],
  ['updatedAt', 'техническая метка времени'],
  ['position', 'порядок в drag-списках, приходит и уходит целиком'],
  ['disabledForStates', 'ждёт StateResolver — подфаза 2.8 (осознанная отложка)'],
  ['currentDays', 'дубль: экран «Держусь» тикает вживую от currentAttemptStartedAt, снимок в днях ему не нужен'],
  ['heldDays', 'дубль attemptDurationMs: фронт форматирует из миллисекунд («9 ч 22 мин», а не «0 дней»)'],
  ['thresholdDays', 'дубль thresholdLabel: человеку показываем ярлык порога, не число'],
]);

/** Рекурсивный обход .ts-файлов каталога. */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...walk(path));
    } else if (name.endsWith('.ts')) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Достаёт имена полей из тел `export interface *View {...}`. Строки-комментарии и вложенные
 * структуры игнорируются: нам нужны имена верхнего уровня, они же и ищутся на фронте.
 */
function viewFields(source) {
  const fields = [];
  const blocks = source.matchAll(/export interface (\w*View\w*)\s*\{([\s\S]*?)\n\}/g);
  for (const [, name, body] of blocks) {
    for (const line of body.split('\n')) {
      const m = /^\s{2}(\w+)\??:/.exec(line);
      if (m) {
        fields.push({ interface: name, field: m[1] });
      }
    }
  }
  return fields;
}

const frontSource = walk(FRONT)
  .filter((p) => basename(p) !== TYPES_MIRROR)
  .map((p) => readFileSync(p, 'utf8'))
  .join('\n');

const findings = [];
let checked = 0;
for (const file of walk(BACK).filter((p) => p.endsWith('view.interface.ts'))) {
  for (const { interface: iface, field } of viewFields(readFileSync(file, 'utf8'))) {
    checked += 1;
    if (ALLOW.has(field)) {
      continue;
    }
    const used = new RegExp(`\\b${field}\\b`).test(frontSource);
    if (!used) {
      findings.push({ iface, field, file: file.replace(ROOT + '/', '') });
    }
  }
}

console.log(`Проверено полей: ${checked} (пропущено по ALLOW: ${ALLOW.size})`);
if (findings.length === 0) {
  console.log('✅ Полей без потребителя на фронте не найдено.');
  process.exit(0);
}
console.log(`\n⚠️  Поля без потребителя на фронте — ${findings.length}:\n`);
for (const f of findings) {
  console.log(`  ${f.iface}.${f.field}`);
  console.log(`      ${f.file}`);
}
console.log(
  '\nЭто сигнал, а не приговор. По каждому ответить: где человек это увидит?\n' +
    'Ответа нет — поле лишнее. Ответ «позже, на этапе N» — в ALLOW с причиной или в TODO-маркер.',
);
process.exit(1);

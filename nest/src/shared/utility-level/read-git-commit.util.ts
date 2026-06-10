import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Длина короткого SHA. */
const SHORT = 7;

/**
 * Короткий git-SHA текущего HEAD рабочего дерева — читается **живо** из `.git`
 * (без кэша), поэтому отражает актуальный `git checkout` (ADR-0044, dev). В проде
 * `.git` не смонтирован → пустая строка (там используется env `GIT_COMMIT` из
 * build-ARG). Все ошибки/отсутствие `.git` → `''` (версия некритична).
 * @returns Короткий SHA или пустая строка.
 */
export function readGitCommit(): string {
  try {
    const gitDir = resolve(process.cwd(), '.git');
    const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();

    // Detached HEAD: в HEAD сразу полный SHA.
    if (!head.startsWith('ref: ')) {
      return head.slice(0, SHORT);
    }

    // На ветке: HEAD = "ref: refs/heads/<branch>" → loose-ref или packed-refs.
    const ref = head.slice('ref: '.length).trim();
    try {
      return readFileSync(join(gitDir, ref), 'utf8').trim().slice(0, SHORT);
    } catch {
      const packed = readFileSync(join(gitDir, 'packed-refs'), 'utf8');
      const line = packed.split('\n').find((entry) => entry.endsWith(` ${ref}`));
      return line ? line.slice(0, SHORT) : '';
    }
  } catch {
    return '';
  }
}

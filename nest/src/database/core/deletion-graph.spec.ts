import { getTableName } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { is } from 'drizzle-orm';
import * as schemas from '../schemas/index';
import { OWNED_EDGES } from './deletion-graph';

/**
 * **Слабые ссылки** — «указывает, но не владеет»: цель ссылки может исчезнуть, факт остаётся.
 * В базе это `set null`, и после ·17 они единственные, кто по-прежнему что-то делает сам.
 */
const WEAK_LINKS = [
  'counterplays.linked_micro_win_id',
  'goals.fallback_micro_win_id',
  'habits.min_version_micro_win_id',
  'anti_habit_events.obstacle_id',
  'obstacle_encounters.counterplay_id',
  'telegram_requests.invite_code_id',
  'admin_audit_log.actor_account_id',
  'app_settings.updated_by',
];

/**
 * **Сторожа** — `restrict`: база не даёт стереть родителя. В фазе 1 это и есть механизм
 * сохранности аккаунта ([ADR-0017](../../../../docs/decisions/0017-account-soft-delete.md)).
 */
const GUARDS = [
  'secret_qa.account_id',
  'sessions.account_id',
  'invitations.account_id',
  'invitations.inviter_id',
  'invite_codes.inviter_id',
  'bans.banner_id',
  'bans.target_id',
  'account_roles.role_id',
];

/**
 * Каждый внешний ключ обязан быть классифицирован (2.9.3·17, [ADR-0068]).
 *
 * **Зачем тест.** Карта владения написана руками — иначе никак: `ON DELETE CASCADE` снят с базы,
 * и в DDL больше нет признака «это владение». Рука забывает; тест — нет. Новый FK, не попавший
 * ни в одну из трёх категорий, роняет сборку **до** того, как окажется, что ребёнок пережил
 * родителя или, наоборот, исчез вместе с ним молча.
 */
describe('карта удаления покрывает все внешние ключи (ADR-0068)', () => {
  const tables = Object.values(schemas).filter((value): value is PgTable => is(value, PgTable));

  /** Все FK схемы в виде `таблица.колонка`. */
  const foreignKeys = tables.flatMap((table) =>
    getTableConfig(table).foreignKeys.flatMap((key) =>
      key.reference().columns.map((column) => `${getTableName(table)}.${column.name}`),
    ),
  );

  /** Рёбра владения в том же виде. */
  const owned = [...OWNED_EDGES.values()].flatMap((edges) =>
    edges.map((edge) => `${getTableName(edge.child)}.${edge.column.name}`),
  );

  it('внешние ключи вообще читаются', () => {
    expect(foreignKeys.length).toBeGreaterThanOrEqual(40);
  });

  it('каждый FK — владение, слабая ссылка или сторож', () => {
    const known = new Set([...owned, ...WEAK_LINKS, ...GUARDS]);
    const unclassified = foreignKeys.filter((key) => !known.has(key));

    expect(unclassified).toEqual([]);
  });

  it('в карте владения нет рёбер, которых нет в схеме', () => {
    const real = new Set(foreignKeys);
    expect(owned.filter((edge) => !real.has(edge))).toEqual([]);
  });
});

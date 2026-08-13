import { accounts } from '../schemas/accounts.schema';
import { accountRoles } from '../schemas/account-roles.schema';
import { accentSettings } from '../schemas/accent-settings.schema';
import { antiHabits } from '../schemas/anti-habits.schema';
import { antiHabitEvents } from '../schemas/anti-habit-events.schema';
import { counterplays } from '../schemas/counterplays.schema';
import { goals } from '../schemas/goals.schema';
import { goalEntries } from '../schemas/goal-entries.schema';
import { habits } from '../schemas/habits.schema';
import { microWins } from '../schemas/micro-wins.schema';
import { microWinLogs } from '../schemas/micro-win-logs.schema';
import { milestones } from '../schemas/milestones.schema';
import { notifications } from '../schemas/notifications.schema';
import { notificationReads } from '../schemas/notification-reads.schema';
import { obstacles } from '../schemas/obstacles.schema';
import { obstacleEncounters } from '../schemas/obstacle-encounters.schema';
import { releases } from '../schemas/releases.schema';
import { sessions } from '../schemas/sessions.schema';
import { sessionTokenHistory } from '../schemas/session-token-history.schema';
import { tasks } from '../schemas/tasks.schema';
import { telegramLinks } from '../schemas/telegram-links.schema';
import { telegramRequests } from '../schemas/telegram-requests.schema';
import { userAchievements } from '../schemas/user-achievements.schema';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

/**
 * Ребро владения: строка-ребёнок не существует без своего родителя
 * ([ADR-0068](../../../../docs/decisions/0068-deletion-belongs-to-storage.md)).
 */
export interface OwnedEdge {
  /** Таблица-ребёнок. */
  child: PgTable;
  /** Колонка ребёнка, ссылающаяся на PK родителя. */
  column: PgColumn;
}

/**
 * Карта владения: родитель → дети, которые уходят вместе с ним.
 *
 * **Почему список руками, а не вывод из `onDelete` схем.** До 2.9.3·17 эту роль играл
 * `ON DELETE CASCADE` — и именно он оказался опасен: физическое удаление любой строки уносило
 * поддерево молча, включая мягко удаляемых внуков, которых полагалось только пометить. Каскад
 * снят с базы, а значит и метаданных «это владение» в DDL больше нет: `no action` стоит и у
 * владения, и у случайной ссылки. Список — единственное место, где эта разница записана.
 *
 * **Список закрыт тестом:** каждый внешний ключ схемы обязан быть классифицирован — владение,
 * слабая ссылка (`set null`) или сторож (`restrict`). Новый FK без решения уронит тест, а не
 * тихо выпадет из каскада.
 */
export const OWNED_EDGES: ReadonlyMap<PgTable, readonly OwnedEdge[]> = new Map<
  PgTable,
  readonly OwnedEdge[]
>([
  [
    accounts,
    [
      { child: accentSettings, column: accentSettings.accountId },
      { child: accountRoles, column: accountRoles.accountId },
      { child: antiHabits, column: antiHabits.accountId },
      { child: goals, column: goals.accountId },
      { child: habits, column: habits.accountId },
      { child: microWins, column: microWins.accountId },
      { child: microWinLogs, column: microWinLogs.accountId },
      { child: notifications, column: notifications.accountId },
      { child: notificationReads, column: notificationReads.accountId },
      { child: obstacles, column: obstacles.accountId },
      { child: tasks, column: tasks.accountId },
      { child: telegramLinks, column: telegramLinks.accountId },
      { child: telegramRequests, column: telegramRequests.accountId },
      { child: userAchievements, column: userAchievements.accountId },
    ],
  ],
  [antiHabits, [{ child: antiHabitEvents, column: antiHabitEvents.antiHabitId }]],
  [
    goals,
    [
      { child: goalEntries, column: goalEntries.goalId },
      { child: milestones, column: milestones.goalId },
      // Подцель не переживает родителя: дерево целей — одна сущность для человека.
      { child: goals, column: goals.parentGoalId },
    ],
  ],
  [habits, [{ child: tasks, column: tasks.templateId }]],
  [microWins, [{ child: microWinLogs, column: microWinLogs.microWinId }]],
  [notifications, [{ child: notificationReads, column: notificationReads.notificationId }]],
  [
    obstacles,
    [
      { child: counterplays, column: counterplays.obstacleId },
      { child: obstacleEncounters, column: obstacleEncounters.obstacleId },
    ],
  ],
  [releases, [{ child: notifications, column: notifications.releaseId }]],
  [sessions, [{ child: sessionTokenHistory, column: sessionTokenHistory.sessionId }]],
]);

/**
 * Дети, уходящие вместе с родителем.
 * @param parent Таблица-родитель.
 * @returns Рёбра владения (пусто, если детей нет).
 */
export function ownedChildren(parent: PgTable): readonly OwnedEdge[] {
  return OWNED_EDGES.get(parent) ?? [];
}

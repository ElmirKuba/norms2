-- Зачистка скрытого контента (реш. Elmir 14.08.2026, ADR-0068).
--
-- **Почему это не самоуправство.** До 2.9.3 «убрать из списка» было дорогой в один конец:
-- вернуть спрятанное человек не мог ничем — экрана архива не существовало. Значит тот, кто
-- прятал, скорее всего хотел удалить: другого способа у него просто не было. С 2.9.3 архив
-- обратим, поэтому старые скрытые записи трактуем как удаление, а не как «положил в архив».
--
-- Мягкое удаление (`deleted_at`), а не физическое: таблицы `paranoid`, и разбор ошибки останется
-- возможным. Метка у всей операции одна — `now()` в транзакции миграции неизменен, — поэтому
-- откатить это можно ровно одним `UPDATE ... SET deleted_at = NULL WHERE deleted_at = '<метка>'`.

-- «Держусь» и их таймлайн
UPDATE "anti_habits" SET "deleted_at" = now() WHERE "is_active" = false AND "deleted_at" IS NULL;
--> statement-breakpoint
UPDATE "anti_habit_events" e SET "deleted_at" = now()
FROM "anti_habits" a
WHERE a."id" = e."anti_habit_id" AND a."deleted_at" = now() AND e."deleted_at" IS NULL;
--> statement-breakpoint

-- Препятствия: контрмеры и журнал столкновений
UPDATE "obstacles" SET "deleted_at" = now() WHERE "is_active" = false AND "deleted_at" IS NULL;
--> statement-breakpoint
UPDATE "counterplays" c SET "deleted_at" = now()
FROM "obstacles" o
WHERE o."id" = c."obstacle_id" AND o."deleted_at" = now() AND c."deleted_at" IS NULL;
--> statement-breakpoint
UPDATE "obstacle_encounters" en SET "deleted_at" = now()
FROM "obstacles" o
WHERE o."id" = en."obstacle_id" AND o."deleted_at" = now() AND en."deleted_at" IS NULL;
--> statement-breakpoint

-- Микро-победы и журнал выполнений
UPDATE "micro_wins" SET "deleted_at" = now() WHERE "is_active" = false AND "deleted_at" IS NULL;
--> statement-breakpoint
UPDATE "micro_win_logs" l SET "deleted_at" = now()
FROM "micro_wins" m
WHERE m."id" = l."micro_win_id" AND m."deleted_at" = now() AND l."deleted_at" IS NULL;
--> statement-breakpoint

-- Шаблоны привычек
UPDATE "habits" SET "deleted_at" = now() WHERE "is_active" = false AND "deleted_at" IS NULL;
--> statement-breakpoint
-- Задачи — таблица `paranoid: false`, то есть удаление там физическое. Сносим только **не
-- тронутые** (`pending`): ровно это и делает деактивация привычки с 2.4. Выполненные и
-- пропущенные дни остаются — это история человека, она кормит статистику и достижения, и
-- стирать её задним числом значило бы переписать его прошлое, а не убрать шаблон.
DELETE FROM "tasks" t
USING "habits" h
WHERE h."id" = t."template_id" AND h."deleted_at" = now() AND t."status" = 'pending';

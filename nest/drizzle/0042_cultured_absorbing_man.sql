CREATE TABLE "releases" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"key" varchar(128) NOT NULL,
	"title" varchar(200) NOT NULL,
	"content_file" varchar(255),
	"content_format" varchar(8) DEFAULT 'md' NOT NULL,
	"published_at" timestamp with time zone,
	"broadcasted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "releases_content_format_check" CHECK ("releases"."content_format" in ('md', 'page'))
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "release_id" varchar(52);--> statement-breakpoint
CREATE UNIQUE INDEX "releases_key_unique" ON "releases" USING btree ("key");--> statement-breakpoint
CREATE INDEX "releases_published_at_idx" ON "releases" USING btree ("published_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_release_id_idx" ON "notifications" USING btree ("release_id");--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────────
-- Перенос данных (ADR-0065, фаза expand). Структуру выше сгенерировал drizzle-kit,
-- эта часть дописана руками: ORM переносить данные не умеет.
--
-- Старые колонки notifications (key, content_file, content_format, published_at,
-- broadcasted_at) НЕ трогаем: между накатом миграции и стартом нового кода на
-- проде работает старый контейнер, и он их читает. Снимем отдельным прогоном
-- (contract) уже после подтверждения выпуска.
--
-- `id` публикации переиспользуем от ноты-доставки: формат uuidv7___unixmillis в
-- SQL не сгенерировать, а совпадение идентификаторов вдобавок показывает
-- происхождение строки. Таблицы разные — коллизии невозможны.
INSERT INTO "releases" ("id", "key", "title", "content_file", "content_format", "published_at", "broadcasted_at", "created_at", "updated_at")
SELECT "id", "key", "title", "content_file", "content_format", "published_at", "broadcasted_at", "created_at", "updated_at"
FROM "notifications"
WHERE "kind" = 'release' AND "key" IS NOT NULL
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

-- Связываем доставку с публикацией по стабильному ключу.
UPDATE "notifications" AS n
SET "release_id" = r."id"
FROM "releases" AS r
WHERE n."kind" = 'release' AND n."key" = r."key" AND n."release_id" IS NULL;

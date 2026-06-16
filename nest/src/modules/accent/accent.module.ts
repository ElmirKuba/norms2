import { Module } from '@nestjs/common';

/**
 * Корневой модуль раздела «Акцент» (фаза 2): цели, привычки, микро-победы,
 * состояние, геймификация. Каркас (подфаза 2.0.0·1) — пока пустой контейнер;
 * по подфазам сюда добавятся настройки раздела (`accent_settings`, пауза — 2.0.0·2–4),
 * затем под-области (micro-wins/habits/goals/…) как отдельные провайдеры/под-модули
 * (feature-first, [ADR-0034](../../../docs/decisions/0034-feature-first-layout.md)).
 * Все сущности раздела вешаются на `account_id` фазы 1 (отдельного User нет,
 * [ADR-0027](../../../docs/decisions/0027-accent-phase2-core.md)). Имена — [ADR-0047].
 */
@Module({})
export class AccentModule {}

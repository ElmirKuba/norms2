import { Module } from '@nestjs/common';
import { AccentSettingsModule } from './settings/accent-settings.module';
import { AccentReferenceModule } from './reference/accent-reference.module';

/**
 * Зонтик раздела «Акцент» (фаза 2, мультимодуль — ADR-0050): импортит area-модули
 * («область = свой модуль», как фаза 1), чтобы `AppModule` оставался чистым. По
 * подфазам сюда добавятся `AccentMicroWinsModule`/`AccentHabitsModule`/`AccentGoalsModule`/…
 * Все сущности раздела — на `account_id` фазы 1 (отдельного User нет, ADR-0027).
 * Имена — ADR-0047. Кросс-домен/кросс-фаза — только вниз через domain-service.
 */
@Module({
  imports: [AccentSettingsModule, AccentReferenceModule],
})
export class AccentModule {}

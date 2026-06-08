import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Главный экран ЛК (обзор). Сюда ведёт бренд «Нормисы». Здесь будут кубики/виджеты
 * краткой статистики по подключённым сервисам (Акцент: цели/задачи; Музыка;
 * Финансы; …) — только для уже существующих. Пока сид-заглушка; полноценная
 * раскладка карточек — отдельный этап F4 (после F1–F3).
 */
@Component({
  selector: 'app-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './overview.component.html',
})
export class OverviewComponent {}

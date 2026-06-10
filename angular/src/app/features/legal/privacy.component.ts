import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Политика конфиденциальности (`/privacy`). Публичная, доступна и ДО cookie-
 * согласия (ADR-0024). Возврат на главную — через бренд в шапке public-layout.
 * Текст — финальная редакция (F6.2): сверена с кодом (no-PII, soft-delete) и
 * ADR-0001/0017/0023; локализация переформулирована вокруг «нет ПДн», ответ на
 * давление — перенос/прекращение по обстоятельствам (ADR-0023, дополнение F6.2).
 */
@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privacy.component.html',
  styleUrl: './legal-page.scss',
})
export class PrivacyComponent {}

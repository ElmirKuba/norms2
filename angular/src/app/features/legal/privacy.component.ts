import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Политика конфиденциальности (`/privacy`). Публичная, доступна и ДО cookie-
 * согласия (ADR-0024). Возврат на главную — через бренд в шапке public-layout.
 * Текст — черновик под ревью (no-PII/152-ФЗ, F5.2).
 */
@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privacy.component.html',
  styleUrl: './legal-page.scss',
})
export class PrivacyComponent {}

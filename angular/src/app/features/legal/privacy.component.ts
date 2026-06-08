import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Политика конфиденциальности (`/privacy`). Публичная, доступна и ДО cookie-
 * согласия (читать политику логично до «Я согласен», ADR-0024). Пока плейсхолдер
 * под будущий полный текст соглашения; ссылка ведёт на главную.
 */
@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {}

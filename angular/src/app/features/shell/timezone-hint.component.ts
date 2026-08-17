import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TimezoneHintService } from './timezone-hint.service';

/**
 * Подсказка «похоже, ты в другом поясе» (2.10·A3) — строкой **внутри панели колокольчика**.
 *
 * **Почему в колоколе, а не полосой над экраном** (реш. Elmir 17.08.2026): «всё равно туда
 * заглянет пользователь». Полоса поверх контента отодвигала весь экран вниз при каждом входе из
 * чужого пояса — в командировке продукт открывают несколько раз в день, и подсказка из полезной
 * превращалась в наказание за поездку. В колоколе она лежит там же, где остальные «продукт хочет
 * тебе кое-что сказать», и не спорит с содержимым страницы.
 *
 * **Чекбокс «не спрашивать про этот пояс»** привязывает отказ к конкретной зоне: отказался в
 * Москве — в Москве тихо; вернулся домой или уехал дальше — отказ забывается сам, потому что
 * устройство сообщает другую зону. В логике нет ни одной даты: нечему протухать.
 *
 * Сама смена пояса здесь **не делается** — ссылка ведёт в настройки, где стоят два подтверждения
 * (·A2), и блок там подсвечивается (`?focus=timezone`), чтобы человек не искал его глазами.
 */
@Component({
  selector: 'app-timezone-hint',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hint.visible()) {
      <div class="tzh" role="status">
        <span class="tzh__text">
          Похоже, ты в другом часовом поясе: <strong>{{ hint.deviceZone() }}</strong
          >. Сейчас день считается по <strong>{{ hint.accountZone() }}</strong
          >.
        </span>
        <div class="tzh__row">
          <label class="tzh__mute">
            <input type="checkbox" (change)="dismiss()" />
            не спрашивать про этот пояс
          </label>
          <button type="button" class="tzh__link" (click)="goToSettings()">Сменить</button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .tzh {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-muted);
        font-size: var(--fs-sm);
        text-align: left;
      }

      .tzh__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }

      .tzh__mute {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        cursor: pointer;
        font-size: var(--fs-xs);
      }

      .tzh__link {
        border: none;
        background: none;
        padding: 0;
        color: var(--color-accent);
        font-size: var(--fs-sm);
        cursor: pointer;
      }

      .tzh__link:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class TimezoneHintComponent {
  private readonly _router = inject(Router);

  /** Состояние подсказки — общее с колоколом, который рисует по нему точку. */
  protected readonly hint = inject(TimezoneHintService);

  /**
   * Запоминает отказ для текущей зоны устройства.
   * @returns Ничего.
   */
  protected dismiss(): void {
    this.hint.dismiss();
  }

  /**
   * Ведёт в настройки — менять пояс нужно там, где стоят два подтверждения.
   *
   * `tab=account` открывает нужную вкладку, `focus=timezone` подсвечивает сам блок: без этого
   * человек попадал на «Безопасность» и искал настройку глазами (замечания Elmir 16–17.08.2026).
   * @returns Ничего.
   */
  protected goToSettings(): void {
    this.hint.hideForNow();
    void this._router.navigate(['/app/settings'], {
      queryParams: { tab: 'account', focus: 'timezone' },
    });
  }
}

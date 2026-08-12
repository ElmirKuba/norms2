import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../services/admin-api.service';
import { AuthStore } from '../../../core/auth/auth-store.service';
import { ModalService } from '../../../shared/modals/modal.service';
import { errorMessage } from '../../../core/http/error-message.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import type { AdminAccount } from '../admin.types';

/** Код роли администратора. */
const ROLE_ADMIN = 'admin';

/**
 * Люди и их роли (2.9.3·10).
 *
 * **Поиск и подгрузка курсором.** Список растёт с конца: пока админ листает, кто-то
 * регистрируется, и на номерах страниц строки начали бы дублироваться и пропадать.
 */
@Component({
  selector: 'app-admin-people',
  imports: [FormsModule, ButtonComponent, CardComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-people.component.html',
  styleUrl: './admin-people.component.scss',
})
export class AdminPeopleComponent {
  private readonly _api = inject(AdminApiService);
  private readonly _modals = inject(ModalService);
  private readonly _authStore = inject(AuthStore);

  /** Загруженные строки. */
  public readonly people = signal<AdminAccount[]>([]);
  /** Курсор следующей страницы или null. */
  public readonly cursor = signal<string | null>(null);
  /** Первая загрузка. */
  public readonly loading = signal(true);
  /** Подгрузка следующей страницы. */
  public readonly loadingMore = signal(false);
  /** Идёт смена роли у этого аккаунта. */
  public readonly busy = signal<string | null>(null);
  /** Текст ошибки или null. */
  public readonly error = signal<string | null>(null);
  /** Строка поиска. */
  public query = '';

  public constructor() {
    this.search();
  }

  /** Ищет с начала: сбрасывает курсор и накопленные строки. */
  public search(): void {
    this.loading.set(true);
    this.error.set(null);
    this._api.listAccounts(this.query.trim(), null).subscribe({
      next: (page) => {
        this.people.set(page.items);
        this.cursor.set(page.nextCursor);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  /** Догружает следующую страницу к уже показанным. */
  public loadMore(): void {
    const cursor = this.cursor();
    if (cursor === null || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this._api.listAccounts(this.query.trim(), cursor).subscribe({
      next: (page) => {
        this.people.update((items) => [...items, ...page.items]);
        this.cursor.set(page.nextCursor);
        this.loadingMore.set(false);
      },
      error: (error: unknown) => {
        this.loadingMore.set(false);
        this._modals.error('Не удалось догрузить', errorMessage(error));
      },
    });
  }

  /**
   * Можно ли показывать кнопку снятия роли администратора.
   *
   * У себя — нельзя: бэк отдаст 409, и показывать кнопку, которая заведомо приводит к отказу,
   * незачем. Запрет там не про самолюбие — аварийного люка в продукте нет, и админ,
   * разжаловавший себя, чинится только скриптом на сервере.
   *
   * @param person Строка человека.
   * @returns Показывать ли кнопку.
   */
  public canRevokeAdmin(person: AdminAccount): boolean {
    return person.id !== this._authStore.account()?.id;
  }

  /**
   * Выдаёт или снимает роль администратора.
   * @param person Кому.
   * @param grant true — выдать, false — снять.
   * @returns Промис завершения.
   */
  public async toggleAdmin(person: AdminAccount, grant: boolean): Promise<void> {
    const confirmed = await this._modals.confirm(
      grant
        ? {
            title: `Выдать админку «${person.login}»?`,
            text: 'Человек сможет менять настройки продукта, роли других людей и удалять публикации.',
            confirmText: 'Выдать',
          }
        : {
            title: `Снять админку с «${person.login}»?`,
            text: 'Права пропадут сразу, без перелогина: роль читается на каждом запросе.',
            confirmText: 'Снять',
            danger: true,
          },
    );
    if (!confirmed) {
      return;
    }

    this.busy.set(person.id);
    const request = grant
      ? this._api.grantRole(person.id, ROLE_ADMIN)
      : this._api.revokeRole(person.id, ROLE_ADMIN);
    request.subscribe({
      next: (updated) => {
        this.people.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.busy.set(null);
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this._modals.error('Не получилось', errorMessage(error));
      },
    });
  }

  /**
   * Админ ли этот человек.
   * @param person Строка человека.
   * @returns Признак роли.
   */
  public isAdmin(person: AdminAccount): boolean {
    return person.roles.includes(ROLE_ADMIN);
  }
}

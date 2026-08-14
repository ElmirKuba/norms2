import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  imports: [FormsModule, RouterLink, ButtonComponent, CardComponent, SpinnerComponent],
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
  /** У кого сейчас открыто поле причины бана (2.9.3·26). */
  public readonly banningId = signal<string | null>(null);

  /** Черновики причин по людям — живут в компоненте, а не в каждой карточке. */
  private readonly _banReasons = signal<Record<string, string>>({});
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
  /**
   * Текущий черновик причины.
   * @param id Кого банят.
   * @returns Написанный текст.
   */
  public banReasonOf(id: string): string {
    return this._banReasons()[id] ?? '';
  }

  /**
   * Запоминает написанную причину.
   * @param id Кого банят.
   * @param value Текст.
   */
  public setBanReason(id: string, value: string): void {
    this._banReasons.update((all) => ({ ...all, [id]: value }));
  }

  /**
   * Открывает поле причины.
   *
   * **Поле, а не модалка-подтверждение:** причину пишут, глядя на человека и его роли, а модалка
   * закрыла бы собой ровно то, ради чего её открыли (тот же приём, что в разборе заявок).
   * @param person Кого банят.
   */
  public startBan(person: AdminAccount): void {
    this.banningId.set(person.id);
  }

  /** Закрывает поле причины, ничего не делая. */
  public cancelBan(): void {
    this.banningId.set(null);
  }

  /**
   * Банит человека от имени админа. Пустую причину не пропускаем на фронте, чтобы человек не
   * ловил 400 после нажатия.
   * @param person Кого банят.
   */
  public confirmBan(person: AdminAccount): void {
    const reason = this.banReasonOf(person.id).trim();
    if (reason === '') {
      this._modals.error('Нужна причина', 'Человек прочитает её при попытке входа — без неё бан непрозрачен.');
      return;
    }
    this.busy.set(person.id);
    this._api.banAccount(person.id, reason).subscribe({
      next: () => {
        this.busy.set(null);
        this.banningId.set(null);
        this.search();
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this._modals.error('Не удалось забанить', errorMessage(error));
      },
    });
  }

  /**
   * Снимает с человека все активные баны.
   * @param person Кого разбанить.
   */
  public liftBans(person: AdminAccount): void {
    this.busy.set(person.id);
    this._api.liftBansOf(person.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.search();
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this._modals.error('Не удалось снять бан', errorMessage(error));
      },
    });
  }

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

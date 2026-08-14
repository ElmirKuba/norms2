import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../services/admin-api.service';
import { ModalService } from '../../../shared/modals/modal.service';
import { errorMessage } from '../../../core/http/error-message.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import type { Observable } from 'rxjs';
import type {
  AdminRequestDecision,
  AdminRequestType,
  AdminRequestStatus,
  AdminTelegramRequest,
} from '../admin.types';

/** Размер страницы. */
const PAGE_SIZE = 20;

/** Номиналы начисления — те же три, что и у кнопок бота. */
const GRANT_AMOUNTS: readonly number[] = [1, 3, 5];

/** Вкладки статусов: что показываем и как это называется на экране. */
const TABS: readonly { status: AdminRequestStatus; label: string }[] = [
  { status: 'pending', label: 'Ждут решения' },
  { status: 'approved', label: 'Одобренные' },
  { status: 'rejected', label: 'Отклонённые' },
  { status: 'expired', label: 'Протухшие' },
];

/**
 * Заявки из Telegram (2.9.3·11).
 *
 * **Решение принимается тем же кодом, что и в боте** — экран зовёт `/admin/telegram/requests`,
 * за которым стоит общий `ReviewRequestsUseCase`. Свой «упрощённый» путь тут был бы вторым
 * источником истины: одна кнопка списывала бы квоту, другая забывала.
 *
 * **Поле причины живёт в карточке, а не в модалке.** Причину пишут, глядя на заявку; модалка
 * закрывает собой то, ради чего её открыли. У одобрения это подпись, которая навсегда остаётся
 * в дереве приглашений, у отказа — текст, который человек прочитает дословно.
 *
 * **Итог решения остаётся на экране, а не всплывает и исчезает.** Если бот молчал, код придётся
 * передать другим способом — а значит его надо видеть, пока админ не уйдёт со страницы.
 */
@Component({
  selector: 'app-admin-requests',
  imports: [FormsModule, ButtonComponent, CardComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-requests.component.html',
  styleUrl: './admin-requests.component.scss',
})
export class AdminRequestsComponent {
  private readonly _api = inject(AdminApiService);
  private readonly _modals = inject(ModalService);

  /** Вкладки статусов. */
  public readonly tabs = TABS;
  /** Допустимые номиналы начисления. */
  public readonly amounts = GRANT_AMOUNTS;

  /** Выбранная вкладка. */
  public readonly status = signal<AdminRequestStatus>('pending');
  /** Загруженные строки. */
  public readonly requests = signal<AdminTelegramRequest[]>([]);
  /** Сколько всего заявок в этом статусе. */
  public readonly total = signal(0);
  /** Первая загрузка. */
  public readonly loading = signal(true);
  /** Подгрузка следующей страницы. */
  public readonly loadingMore = signal(false);
  /** Идёт решение по этой заявке. */
  public readonly busy = signal<string | null>(null);
  /** Текст ошибки загрузки или null. */
  public readonly error = signal<string | null>(null);
  /** Итоги принятых за этот заход решений: заявка → что получилось. */
  public readonly outcomes = signal<Record<string, AdminRequestDecision>>({});

  /** Написанные причины по заявкам — черновики живут в компоненте, а не в каждой карточке. */
  private readonly _reasons = signal<Record<string, string>>({});

  /** Есть ли ещё страницы. */
  public readonly hasMore = computed(() => this.requests().length < this.total());

  public constructor() {
    this.reload();
  }

  /**
   * Переключает вкладку и грузит её с начала.
   * @param status Новый статус.
   */
  public selectTab(status: AdminRequestStatus): void {
    if (this.status() === status) {
      return;
    }
    this.status.set(status);
    this.reload();
  }

  /** Грузит первую страницу выбранного статуса. */
  public reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this._api.listRequests(this.status(), 0, PAGE_SIZE).subscribe({
      next: (page) => {
        this.requests.set(page.items);
        this.total.set(page.total);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  /** Догружает следующую страницу к показанным. */
  public loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) {
      return;
    }
    this.loadingMore.set(true);
    this._api.listRequests(this.status(), this.requests().length, PAGE_SIZE).subscribe({
      next: (page) => {
        this.requests.update((items) => [...items, ...page.items]);
        this.total.set(page.total);
        this.loadingMore.set(false);
      },
      error: (error: unknown) => {
        this.loadingMore.set(false);
        this._modals.error('Не удалось догрузить', errorMessage(error));
      },
    });
  }

  /**
   * Текущий черновик причины по заявке.
   * @param id Заявка.
   * @returns Написанный текст.
   */
  public reasonOf(id: string): string {
    return this._reasons()[id] ?? '';
  }

  /**
   * Запоминает написанную причину.
   * @param id Заявка.
   * @param value Текст.
   */
  public setReason(id: string, value: string): void {
    this._reasons.update((all) => ({ ...all, [id]: value }));
  }

  /**
   * Итог решения по заявке, если оно принято в этом заходе.
   * @param id Заявка.
   * @returns Итог или undefined.
   */
  public outcomeOf(id: string): AdminRequestDecision | undefined {
    return this.outcomes()[id];
  }

  /**
   * Одобряет заявку на вступление — выдаётся код приглашения.
   *
   * Подтверждение обязательно: это раздача доступа в закрытый продукт, а подпись останется в
   * дереве приглашений навсегда и её увидит приглашённый.
   * @param request Заявка.
   * @returns Промис завершения.
   */
  public async approve(request: AdminTelegramRequest): Promise<void> {
    const confirmed = await this._modals.confirm({
      title: request.type === 'unban' ? 'Снять бан?' : 'Выдать код приглашения?',
      text:
        request.type === 'unban'
          ? 'Снимутся ВСЕ активные баны на этом человеке, включая наложенные другими. Вход откроется сразу.'
          : 'Код спишется с вашей квоты, а подпись останется в дереве приглашений навсегда — её увидит приглашённый.',
      confirmText: request.type === 'unban' ? 'Снять бан' : 'Выдать код',
    });
    if (!confirmed) {
      return;
    }
    this._decide(request, this._api.approveRequest(request.id, this.reasonOf(request.id)));
  }

  /**
   * Начисляет приглашения по просьбе.
   *
   * **Номинал только из трёх** (`+1 / +3 / +5`) — как в боте. Свободное поле тут не годится по
   * той же причине: это раздача доступа, а лишний ноль вводится в спешке незаметно.
   * @param request Заявка.
   * @param amount Сколько начислить.
   * @returns Промис завершения.
   */
  public async grant(request: AdminTelegramRequest, amount: number): Promise<void> {
    const who = request.accountLogin ?? 'этому человеку';
    const confirmed = await this._modals.confirm({
      title: `Начислить +${String(amount)}?`,
      text: `«${who}» сможет пригласить ещё ${String(amount)} человек. Отменить начисление нельзя.`,
      confirmText: `Начислить +${String(amount)}`,
    });
    if (!confirmed) {
      return;
    }
    this._decide(
      request,
      this._api.approveRequest(request.id, this.reasonOf(request.id), amount),
    );
  }

  /**
   * Отказывает по заявке. Причина уходит человеку дословно — об этом и предупреждаем.
   * @param request Заявка.
   * @returns Промис завершения.
   */
  public async reject(request: AdminTelegramRequest): Promise<void> {
    const reason = this.reasonOf(request.id).trim();
    const confirmed = await this._modals.confirm({
      title: 'Отказать по заявке?',
      text:
        reason === ''
          ? 'Человек получит отказ без объяснения. Заявку заново он подать сможет.'
          : `Человек прочитает причину дословно: «${reason}»`,
      confirmText: 'Отказать',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this._decide(request, this._api.rejectRequest(request.id, this.reasonOf(request.id)));
  }

  /**
   * Тип заявки словами.
   * @param request Заявка.
   * @returns Подпись.
   */
  public typeLabel(request: AdminTelegramRequest): string {
    const labels: Record<AdminRequestType, string> = {
      join: 'Хочет вступить',
      more_invites: 'Просит приглашений',
      unban: 'Просит снять бан',
    };
    return labels[request.type];
  }

  /**
   * Подпись к полю причины — она у каждого типа про своё.
   * @param request Заявка.
   * @returns Текст подписи.
   */
  public reasonLabel(request: AdminTelegramRequest): string {
    const labels: Record<AdminRequestType, string> = {
      join: 'Подпись к приглашению — останется в дереве навсегда',
      more_invites: 'За что начисляем — человек это прочитает',
      unban: 'Что написать человеку — он прочитает это дословно',
    };
    return labels[request.type];
  }

  /**
   * Статус заявки словами.
   * @param request Заявка.
   * @returns Подпись.
   */
  public statusLabel(request: AdminTelegramRequest): string {
    const labels: Record<AdminRequestStatus, string> = {
      pending: 'Ждёт решения',
      approved: 'Одобрена',
      rejected: 'Отклонена',
      expired: 'Протухла',
    };
    return labels[request.status];
  }

  /**
   * Дата человеческим видом.
   * @param iso Метка времени или null.
   * @returns Строка вида «5 августа, 14:07» или прочерк.
   */
  public when(iso: string | null): string {
    if (iso === null) {
      return '—';
    }
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Проводит решение и заменяет строку в списке.
   *
   * Строка **заменяется, а не перезагружается весь список**: остальные заявки не менялись, а
   * перезагрузка увела бы карточку с экрана вместе с только что выданным кодом.
   * @param request Заявка.
   * @param call Запрос решения.
   */
  private _decide(request: AdminTelegramRequest, call: Observable<AdminRequestDecision>): void {
    this.busy.set(request.id);
    call.subscribe({
      next: (decision) => {
        this.busy.set(null);
        this.outcomes.update((all) => ({ ...all, [request.id]: decision }));
        this.requests.update((items) =>
          items.map((item) => (item.id === decision.request.id ? decision.request : item)),
        );
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this._modals.error('Решение не прошло', errorMessage(error));
        // Отказ почти всегда значит «состояние разъехалось»: заявку закрыли из бота, квота
        // кончилась. Список перечитываем, чтобы экран не спорил с базой.
        this.reload();
      },
    });
  }
}

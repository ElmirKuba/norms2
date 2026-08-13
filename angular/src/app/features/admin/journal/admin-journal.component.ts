import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminApiService } from '../services/admin-api.service';
import { errorMessage } from '../../../core/http/error-message.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import type { AdminAuditEntry } from '../admin.types';

/** Сколько записей показываем сразу и до скольких доращиваем по кнопке (потолок бэка — 500). */
const PAGE_SIZE = 100;
const FULL_SIZE = 500;

/**
 * Действия по-русски. **Ключ — машинный код из `AUDIT_ACTIONS` бэка**, и словарь неполный по
 * определению: коды в записях остаются навсегда, а справочник живёт вместе с кодом. Незнакомый
 * код показывается как есть — это честнее, чем «неизвестное действие».
 */
const ACTIONS: Record<string, string> = {
  'role.granted': 'Роль выдана',
  'role.revoked': 'Роль снята',
  'role.backfilled': 'Базовая роль досыпана',
  'setting.changed': 'Настройка изменена',
  'release.created': 'Публикация зарегистрирована',
  'release.broadcasted': 'Релиз объявлен в канал',
  'release.deleted': 'Публикация удалена',
  'telegram.request.approved': 'Заявка одобрена — выдан код',
  'telegram.request.granted': 'Начислены приглашения',
  'telegram.request.rejected': 'По заявке отказано',
};

/** Над чем действовали — по-русски. */
const TARGETS: Record<string, string> = {
  account: 'аккаунт',
  setting: 'настройка',
  release: 'релиз',
  telegram_request: 'заявка',
};

/**
 * Метки целей-заявок: бэк кладёт в `targetLabel` тип заявки машинным кодом — читать «заявка:
 * more_invites» человеку незачем.
 */
const REQUEST_LABELS: Record<string, string> = {
  join: 'вступление',
  more_invites: 'приглашения',
};

/** Ключи подробностей по-русски; незнакомый ключ показывается как есть. */
const DETAILS: Record<string, string> = {
  role: 'роль',
  count: 'сколько',
  from: 'было',
  to: 'стало',
  sent: 'ушло в канал',
  notified: 'человек оповещён',
  reason: 'причина',
  code: 'код',
  amount: 'начислено',
  contentFormat: 'вид',
  contentFile: 'файл',
};

/**
 * Журнал действий администратора (2.9.3·14) — «кто, что, когда, над кем».
 *
 * **Экран только читает.** Ни правки, ни удаления записей здесь нет — и не появится: их нет даже
 * в порте репозитория на бэке (·6). Журнал, умеющий править себя, не доказывает ничего.
 *
 * **Пустой актёр — это «система», а не прочерк.** Сид выдаёт роли при старте, и это такое же
 * изменение прав, как ручное: строка о нём должна читаться так же полноценно.
 */
@Component({
  selector: 'app-admin-journal',
  imports: [ButtonComponent, CardComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-journal.component.html',
  styleUrl: './admin-journal.component.scss',
})
export class AdminJournalComponent {
  private readonly _api = inject(AdminApiService);

  /** Варианты фильтра: код действия и его подпись. */
  public readonly actionOptions = Object.entries(ACTIONS).map(([code, label]) => ({ code, label }));

  /** Выбранный код действия или null — показываем все. */
  public readonly action = signal<string | null>(null);
  /** Сколько записей просим у бэка. */
  public readonly limit = signal(PAGE_SIZE);
  /** Загруженные строки. */
  public readonly entries = signal<AdminAuditEntry[]>([]);
  /** Идёт загрузка. */
  public readonly loading = signal(true);
  /** Текст ошибки или null. */
  public readonly error = signal<string | null>(null);

  /**
   * Похоже, что показано не всё: бэк вернул ровно столько, сколько просили.
   *
   * Точного «сколько всего» здесь нет намеренно — счётчик по всему журналу экрану не нужен, а
   * лишний запрос ради него стоит дороже, чем честная кнопка «показать больше».
   */
  public readonly maybeMore = computed(
    () => this.entries().length >= this.limit() && this.limit() < FULL_SIZE,
  );

  public constructor() {
    this.reload();
  }

  /**
   * Меняет фильтр по действию и перечитывает ленту с начала.
   * @param code Код действия или пустая строка — «все».
   */
  public selectAction(code: string): void {
    this.action.set(code === '' ? null : code);
    this.limit.set(PAGE_SIZE);
    this.reload();
  }

  /** Доращивает выборку до потолка и перечитывает. */
  public showMore(): void {
    this.limit.set(FULL_SIZE);
    this.reload();
  }

  /** Перечитывает ленту. */
  public reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this._api.listAuditLog(this.action(), this.limit()).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  /**
   * Кто действовал.
   * @param entry Запись.
   * @returns Логин или «система».
   */
  public actorOf(entry: AdminAuditEntry): string {
    return entry.actorLogin ?? 'система';
  }

  /**
   * Что произошло.
   * @param entry Запись.
   * @returns Подпись действия или сам код, если он словарю незнаком.
   */
  public actionLabel(entry: AdminAuditEntry): string {
    return ACTIONS[entry.action] ?? entry.action;
  }

  /**
   * Над кем действовали.
   * @param entry Запись.
   * @returns Строка вида «аккаунт: audit_probe» или пусто, если цели нет.
   */
  public targetLabel(entry: AdminAuditEntry): string {
    const raw = entry.targetLabel ?? entry.targetId;
    if (raw === null) {
      return '';
    }
    const what = entry.targetType === 'telegram_request' ? (REQUEST_LABELS[raw] ?? raw) : raw;
    const kind = entry.targetType === null ? null : (TARGETS[entry.targetType] ?? entry.targetType);
    return kind === null ? what : `${kind}: ${what}`;
  }

  /**
   * Подробности парами «что — чем стало».
   * @param entry Запись.
   * @returns Пары для показа; пусто, если подробностей нет.
   */
  public detailsOf(entry: AdminAuditEntry): { label: string; value: string }[] {
    if (entry.details === null) {
      return [];
    }
    return Object.entries(entry.details).map(([key, value]) => ({
      label: DETAILS[key] ?? key,
      value: this._value(value),
    }));
  }

  /**
   * Дата человеческим видом.
   * @param iso Метка времени.
   * @returns Строка вида «13 августа, 12:35».
   */
  public when(iso: string): string {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Значение подробности словами.
   * @param value Что лежит в json.
   * @returns Строка для экрана.
   */
  private _value(value: unknown): string {
    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'boolean') {
      return value ? 'да' : 'нет';
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
    return JSON.stringify(value);
  }
}

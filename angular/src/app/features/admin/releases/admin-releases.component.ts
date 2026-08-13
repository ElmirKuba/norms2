import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../services/admin-api.service';
import { ModalService } from '../../../shared/modals/modal.service';
import { errorMessage } from '../../../core/http/error-message.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import type { AdminRelease, AdminReleaseFormat } from '../admin.types';

/**
 * Публикации релизов (2.9.3·13): список, регистрация, вещание в канал, удаление.
 *
 * **Вещание — отдельная кнопка, а не следствие создания.** Именно автоматика «появился релиз →
 * ушёл пост» заставила гасить бота при выкатке 2.9.2. Момент, когда о выпуске узнают, выбирает
 * человек.
 *
 * **Форма регистрирует публикацию, а не создаёт текст.** Файл ноты приезжает вместе с образом —
 * загрузки контента тут нет и не будет: иначе история выпусков оторвётся от git.
 */
@Component({
  selector: 'app-admin-releases',
  imports: [FormsModule, ButtonComponent, CardComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-releases.component.html',
  styleUrl: './admin-releases.component.scss',
})
export class AdminReleasesComponent {
  private readonly _api = inject(AdminApiService);
  private readonly _modals = inject(ModalService);

  /** Загруженные публикации. */
  public readonly releases = signal<AdminRelease[]>([]);
  /** Первая загрузка. */
  public readonly loading = signal(true);
  /** Текст ошибки загрузки или null. */
  public readonly error = signal<string | null>(null);
  /** Идёт действие по этому ключу. */
  public readonly busy = signal<string | null>(null);
  /** Форма создания раскрыта. */
  public readonly formOpen = signal(false);
  /** Идёт создание. */
  public readonly creating = signal(false);

  /** Поля формы создания. */
  public key = '';
  public title = '';
  public contentFile = '';
  public contentFormat: AdminReleaseFormat = 'md';

  public constructor() {
    this.reload();
  }

  /** Перечитывает список публикаций. */
  public reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this._api.listReleases().subscribe({
      next: (items) => {
        this.releases.set(items);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  /** Показывает или прячет форму создания. */
  public toggleForm(): void {
    this.formOpen.update((open) => !open);
  }

  /** Регистрирует публикацию. В канал ничего не уходит — для этого есть отдельная кнопка. */
  public create(): void {
    this.creating.set(true);
    const file = this.contentFormat === 'md' ? this.contentFile.trim() : null;
    this._api.createRelease(this.key.trim(), this.title.trim(), this.contentFormat, file).subscribe({
      next: (release) => {
        this.creating.set(false);
        this.formOpen.set(false);
        this.key = '';
        this.title = '';
        this.contentFile = '';
        // Новая публикация встаёт наверх — так же, как её увидит витрина.
        this.releases.update((items) => [release, ...items]);
      },
      error: (error: unknown) => {
        this.creating.set(false);
        this._modals.error('Не получилось создать', errorMessage(error));
      },
    });
  }

  /**
   * Объявляет релиз в канал.
   *
   * Подтверждение обязательно и необратимо по-настоящему: **свой пост бот удалять не умеет** —
   * id постов канала нигде не хранятся, чистить придётся руками в Telegram.
   * @param release Публикация.
   * @returns Промис завершения.
   */
  public async broadcast(release: AdminRelease): Promise<void> {
    const confirmed = await this._modals.confirm({
      title: `Объявить «${release.title}» в канал?`,
      text: 'Пост уйдёт подписчикам канала сразу. Удалить его потом бот не сможет — только руками в Telegram.',
      confirmText: 'Объявить',
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(release.key);
    this._api.broadcastRelease(release.key).subscribe({
      next: (result) => {
        this.busy.set(null);
        this.releases.update((items) =>
          items.map((item) =>
            item.key === release.key ? { ...item, broadcastedAt: result.broadcastedAt } : item,
          ),
        );
        if (!result.sent) {
          // Отметки не будет: непрошедший пост не должен навсегда считаться объявленным.
          this._modals.error(
            'Пост не ушёл',
            'Канал не принял сообщение. Отметки о вещании не появилось — можно попробовать снова.',
          );
        }
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this._modals.error('Не получилось объявить', errorMessage(error));
        this.reload();
      },
    });
  }

  /**
   * Удаляет публикацию вместе с доставкой и отметками прочтения.
   *
   * Подтверждение с вводом ключа: нота исчезнет из колокольчиков у всех, а пост в Telegram
   * останется — половина следа удалится, половина нет, и человек должен это осознать.
   * @param release Публикация.
   * @returns Промис завершения.
   */
  public async remove(release: AdminRelease): Promise<void> {
    const confirmed = await this._modals.confirm({
      title: `Удалить публикацию «${release.key}»?`,
      text: 'Нота исчезнет из колокольчиков вместе с отметками «прочитано». Пост в Telegram при этом останется — бот его удалить не умеет.',
      confirmText: 'Удалить',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(release.key);
    this._api.deleteRelease(release.key).subscribe({
      next: () => {
        this.busy.set(null);
        this.releases.update((items) => items.filter((item) => item.key !== release.key));
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this._modals.error('Не получилось удалить', errorMessage(error));
        this.reload();
      },
    });
  }

  /**
   * Дата человеческим видом.
   * @param iso Метка времени или null.
   * @returns Строка или прочерк.
   */
  public when(iso: string | null): string {
    if (iso === null) {
      return '—';
    }
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

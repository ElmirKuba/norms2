import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Принцип проекта (карточка). */
interface Principle {
  /** Заголовок. */
  title: string;
  /** Пояснение. */
  text: string;
}

/** Технология стека с обоснованием выбора. */
interface StackItem {
  /** Название. */
  name: string;
  /** Почему выбрана. */
  why: string;
}

/**
 * О проекте (`/about`) — манифест прозрачности: миссия, принципы, стек с «почему»,
 * прозрачно про Claude Code, open source + лицензия + self-host, честно о рисках,
 * контакты. Публичная, доступна до cookie-согласия. Данные — массивы (сетка карточек).
 */
@Component({
  selector: 'app-about',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  /** Контакт в Telegram. */
  protected readonly telegram = '@elmir_kuba';
  /** Ссылка на Telegram. */
  protected readonly telegramUrl = 'https://t.me/elmir_kuba';
  /** Публичный репозиторий. */
  protected readonly githubUrl = 'https://github.com/ElmirKuba/norms2';

  /** Принципы проекта. */
  protected readonly principles: readonly Principle[] = [
    { title: 'Без персональных данных', text: 'Участники — псевдонимы и логины. ПДн мы не собираем (152-ФЗ).' },
    { title: 'Без рекламы и слежки', text: 'Только технические cookie. Ни трекеров, ни рекламных сетей.' },
    { title: 'Открытый код и self-host', text: 'Код открыт (Apache-2.0). Разверни у себя и не завись от нас.' },
    { title: 'Честно, без гарантий', text: 'Некоммерческий проект. Не обещаем сохранность данных; можем выключиться.' },
    { title: 'Развитие, не прибыль', text: 'Цель — рост участников и разработчиков, а не монетизация.' },
  ];

  /** Стек технологий с обоснованием. */
  protected readonly stack: readonly StackItem[] = [
    {
      name: 'Angular',
      why: 'Standalone-компоненты и Signals, строгая типизация, всё своё (без CSS-китов), один целостный фреймворк и путь к нативке.',
    },
    {
      name: 'NestJS',
      why: 'Модульная 5-слойная архитектура с чистыми границами (controllers → use-cases → domain → adapters → repositories); один язык на фронте и бэке.',
    },
    {
      name: 'Drizzle ORM',
      why: 'Тонкий слой, не прячет SQL; явные миграции без auto-push в проде; ORM не протекает в домен.',
    },
    {
      name: 'PostgreSQL',
      why: 'Надёжная БД с рекурсивными CTE (на них держится дерево приглашений), open source, self-hostable.',
    },
    {
      name: 'Docker + Traefik',
      why: 'Контейнеры (dev = prod) и авто-TLS (Let’s Encrypt) — стек разворачивается одной командой.',
    },
    {
      name: 'Чистый SCSS',
      why: 'Свои компоненты и дизайн-токены, полный контроль над видом, без раздутых фреймворков.',
    },
  ];
}

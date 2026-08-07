import { ChangeDetectionStrategy, Component , ViewEncapsulation } from '@angular/core';

/**
 * Контентные секции лендинга 2.0: сравнение, тарифы, особые случаи, штат, гарантии и вопросы.
 *
 * **Почему отдельный компонент, а не часть страницы.** Прод-сборка проверяет бюджет стилей на
 * компонент (10 КБ), и лендинг одним куском в него не влезал — 11.75 КБ. Поднимать бюджет всему
 * проекту ради одной страницы неправильно: он и существует, чтобы ловить раздувание. Дробление
 * по секциям решает это честно и заодно делает страницу читаемой.
 *
 * Разметка статична: это текст релиза, а не данные, — поэтому ни входов, ни состояния.
 */
@Component({
  selector: 'app-release-2-0-0-sections',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Правила лежат под `.release-landing`, поэтому глобально ничего не течёт.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './release-2-0-0-sections.component.html',
  styleUrl: './release-2-0-0-sections.component.scss',
})
export class Release200SectionsComponent {}

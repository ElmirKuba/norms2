import { Directive } from '@angular/core';
import type { TodoView } from '../accent.types';

/** Что шаблон узла получает на вход. */
export interface TodoNodeContext {
  /** Сама запись. */
  $implicit: TodoView;
  /** Уровень вложенности, считая от 1 у корня. */
  depth: number;
}

/**
 * Типизирует контекст рекурсивного шаблона узла списка дел.
 *
 * **Зачем директива ради одного шаблона.** `let-item` в `ng-template` — неявный `any`: компилятор
 * молча пропустит и опечатку в поле, и вызов несуществующего метода, а в проекте `any` запрещён.
 * `ngTemplateContextGuard` возвращает шаблону настоящие типы, ничего не делая в рантайме.
 */
@Directive({ selector: 'ng-template[todoNode]' })
export class TodoNodeContextDirective {
  /**
   * Подсказка компилятору о типе контекста.
   * @param _directive Экземпляр директивы (не используется).
   * @param _context Контекст шаблона.
   * @returns Всегда `true` — гард нужен только на этапе компиляции.
   */
  public static ngTemplateContextGuard(
    _directive: TodoNodeContextDirective,
    _context: unknown,
  ): _context is TodoNodeContext {
    return true;
  }
}

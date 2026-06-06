import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Карточка-поверхность (контейнер контента). */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent {}

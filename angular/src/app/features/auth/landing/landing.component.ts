import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Главная (landing) для неаутентифицированных: название + строка вайба + две CTA
 * «Войти»/«Регистрация». Минимализм — это не воронка, а закрытое «для своих».
 * Переключатель темы — в публичном layout. CTA «Регистрация» ведёт на /register
 * (там при invite-only сначала экран кода — F2.4).
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {}

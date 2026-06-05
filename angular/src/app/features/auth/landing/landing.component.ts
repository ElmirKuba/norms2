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
  template: `
    <section class="landing">
      <h1 class="brand">Нормисы</h1>
      <p class="tagline">Своя территория. По приглашениям — без рекламы и слежки.</p>
      <nav class="cta">
        <a class="btn btn-block" routerLink="/login">Войти</a>
        <a class="btn btn-ghost btn-block" routerLink="/register">Регистрация</a>
      </nav>
    </section>
  `,
  styles: [
    `
      @use 'breakpoints' as bp;

      .landing {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: var(--space-3);
        width: 100%;
      }
      .brand {
        font-size: var(--fs-2xl);
        letter-spacing: 0.02em;
      }
      .tagline {
        color: var(--color-text-muted);
        max-width: 32ch;
        margin-bottom: var(--space-4);
      }
      .cta {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        width: 100%;

        @include bp.up('sm') {
          flex-direction: row;
          justify-content: center;
        }
      }
      .cta .btn {
        @include bp.up('sm') {
          width: auto;
          min-width: 160px;
        }
      }
    `,
  ],
})
export class LandingComponent {}

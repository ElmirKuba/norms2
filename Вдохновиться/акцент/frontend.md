# Frontend (Angular)

Корень — `./angular/`. Стек объявлен в [`../Technical-assignment.md#стек`](../Technical-assignment.md#3-стек).

## Структура

```
angular/
├── src/
│   ├── main.ts
│   ├── index.html
│   ├── styles.css                    # Tailwind directives + CSS-переменные
│   ├── app/
│   │   ├── app.component.ts          # корневой shell
│   │   ├── app.config.ts             # provideRouter, provideHttpClient, ...
│   │   ├── app.routes.ts             # lazy-loaded routes
│   │   ├── core/
│   │   │   ├── auth/                 # AuthService, AuthGuard, interceptor
│   │   │   ├── api/                  # HTTP-сервисы по доменам
│   │   │   ├── http/                 # interceptors (auth, error, loader)
│   │   │   ├── realtime/             # WebSocketService
│   │   │   ├── i18n/                 # переключение локали
│   │   │   └── types/                # общие типы (DTO как mirror бэка)
│   │   ├── shared/
│   │   │   ├── components/           # переиспользуемые: button, card, badge, ...
│   │   │   ├── directives/
│   │   │   ├── pipes/
│   │   │   └── ui/                   # design-system компоненты
│   │   └── features/
│   │       ├── auth/                 # login, register
│   │       ├── dashboard/
│   │       ├── goals/
│   │       ├── tasks/
│   │       ├── anti-habits/
│   │       ├── weekly/
│   │       ├── metrics/
│   │       ├── lessons/
│   │       ├── workouts/
│   │       ├── scheduled/
│   │       ├── stats/
│   │       └── settings/
│   ├── assets/
│   └── environments/
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── angular.json
├── tsconfig.json
└── Dockerfile
```

## Принципы

### Standalone-компоненты

Никаких `NgModule` для фич. Маршруты — массив с `loadComponent`:

```ts
// app.routes.ts
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/dashboard' },
  { path: 'login', loadComponent: () => import('./features/auth/login.page').then(m => m.LoginPage) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage) },
      { path: 'goals', loadChildren: () => import('./features/goals/goals.routes').then(m => m.routes) },
      // ...
    ],
  },
];
```

### Состояние

- **Локальное состояние** — `signal()` внутри компонента или сервиса.
- **Производное** — `computed()`.
- **Async-операции** — `toSignal(observable$)` для конвертации.
- **NgRx — НЕ используем.** Глобальное состояние держится в singleton-сервисах в `core/` через signals.

```ts
// core/auth/auth.service.ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  setUser(user: User | null) { this._user.set(user); }
}
```

### HTTP

- Только через сервисы из `core/api/`. Компоненты не делают `HttpClient.get` напрямую.
- Все DTO-типы — в `core/api/<domain>.types.ts`.
- Interceptors:
  - `authInterceptor` — добавляет `Authorization`, на 401 пытается refresh, потом — редирект на login.
  - `errorInterceptor` — единая обработка ошибок, mapping `code` из ответа в локализованное сообщение.
  - `loaderInterceptor` — глобальный progress bar (опционально).

```ts
// core/api/goals.service.ts
@Injectable({ providedIn: 'root' })
export class GoalsApiService {
  private http = inject(HttpClient);

  list(filters?: GoalFilters): Observable<Goal[]> {
    return this.http.get<{ items: Goal[] }>('/api/goals', { params: filters as any })
      .pipe(map(r => r.items));
  }

  addEntry(goalId: string, dto: AddEntryDto) {
    return this.http.post<GoalEntry>(`/api/goals/${goalId}/entries`, dto);
  }
}
```

### Формы

Только Reactive Forms. Никаких `ngModel`.

```ts
form = this.fb.nonNullable.group({
  title: ['', [Validators.required, Validators.maxLength(200)]],
  category: ['physical' as const, Validators.required],
  targetValue: [1, [Validators.required, Validators.min(0.001)]],
  unit: ['', Validators.required],
  deadline: [''],
});
```

### Стили

TailwindCSS 3. Дизайн-токены — в `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      bg: { DEFAULT: '#0a0a0a', elevated: '#171717', overlay: '#1f1f1f' },
      fg: { DEFAULT: '#fafafa', muted: '#a1a1aa', subtle: '#71717a' },
      accent: { DEFAULT: '#d4c5a3', strong: '#c9b687' },  // бежевый из исходного шаблона
      success: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      display: ['Comfortaa', 'sans-serif'],   // в шаблоне видно decorative-шрифт
    },
  },
}
```

Подробно про дизайн-систему — [`./ui-ux.md`](./ui-ux.md).

### Компоненты

Размер — не больше 200 строк TypeScript на компонент. Если больше — выделить child-компонент или сервис.

Шаблон — в отдельном `*.html` файле для компонентов от ~30 строк template, иначе inline.

```ts
@Component({
  selector: 'app-goal-card',
  standalone: true,
  imports: [CommonModule, ProgressBarComponent],
  templateUrl: './goal-card.component.html',
})
export class GoalCardComponent {
  goal = input.required<Goal>();
  increment = output<number>();

  daysLeftLabel = computed(() => {
    const days = this.goal().daysLeft;
    return days === null ? null : days <= 0 ? 'просрочено' : `осталось ${days} дн.`;
  });
}
```

Использование сигналов в шаблоне:
```html
<h3>{{ goal().title }}</h3>
<p>{{ daysLeftLabel() }}</p>
```

### i18n

В фазе 9. Кандидаты: встроенный Angular `@angular/localize` или `@ngx-translate/core`. Решение — на старте фазы 9; до тех пор все строки на русском в шаблонах.

### Realtime

`WebSocketService` в `core/realtime/`. Подключается после успешного логина:

```ts
ws.connect();
ws.on<AchievementUnlocked>('achievement.unlocked').subscribe(e => toaster.show(...));
ws.on('dashboard.invalidate').subscribe(() => dashboardSignal.reload());
```

### Графики

`ng-apexcharts`. Один общий wrapper-компонент `<app-chart>` с типизированной конфигурацией, чтобы не повторять boilerplate.

### Иконки

`lucide-angular`. Каждый экран импортирует только нужные иконки — tree-shaking.

## Тесты

- **Unit (Jest):** сервисы и логика компонентов.
- **Component-level:** Angular Testing Library.
- **E2E:** Playwright в фазе 9.

## Запуск (dev)

```bash
cd angular
npm install
npm start    # или ng serve --port 4200
```

`environments/environment.ts` указывает API: `apiUrl: '/api'` (с прокси через `proxy.conf.json` на `http://localhost:3000` в dev).

## Mobile-first

- Базовый брекпоинт — мобильный (`min-width: 0`).
- `sm: 640px` и выше — десктопные расширения (двухколоночные дашборды, sidebar).
- Touch targets ≥ 44×44px.
- Без hover-only взаимодействий — везде есть touch-эквивалент.

Дизайн-гайды — [`./ui-ux.md`](./ui-ux.md).

## Будущее: Capacitor

Структура подготовлена так, что обёртывание в Capacitor (фаза post-MVP) не потребует переписывания:

- Хранение токенов вынесено в `core/auth/token-storage.ts` с интерфейсом `TokenStorage`. Дефолтная реализация — `localStorage`/`cookie`. Capacitor-вариант — `Preferences` плагин.
- Все абсолютные URL берутся из `environment.apiUrl`. Никаких хардкодов.
- WebSocket-URL — также из environment.

Тот же паттерн платформенной абстракции через Angular DI (сервис с интерфейсом, реализация выбирается на старте) — пригодится при оборачивании в Capacitor для iOS/Android.

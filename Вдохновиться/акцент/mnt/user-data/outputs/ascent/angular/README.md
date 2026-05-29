# angular/

Здесь живёт фронтенд на **Angular 17+ standalone + Signals + TailwindCSS + ApexCharts + lucide-angular**.

На момент написания этого файла папка пустая — проект ещё не инициализирован. Бутстрап — часть **Фазы 1** в [`../todo.md`](../todo.md), запускается параллельно с бэком.

## Перед тем как писать код — прочитать

1. [`../Technical-assignment.md`](../Technical-assignment.md) — что строим
2. [`../claude.md`](../claude.md) — как работаем
3. [`../docs/architecture.md`](../docs/architecture.md) — общие границы
4. [`../docs/frontend.md`](../docs/frontend.md) — конвенции фронта (структура, signals, HTTP, формы)
5. [`../docs/ui-ux.md`](../docs/ui-ux.md) — дизайн-система, цвета, экраны
6. [`../docs/api-contracts.md`](../docs/api-contracts.md) — какие endpoint'ы дёргать и что они возвращают

## Инициализация (первый раз)

Из корня репо:

```bash
npx @angular/cli@latest new angular \
    --routing \
    --style=scss \
    --standalone \
    --strict \
    --ssr=false \
    --package-manager=npm
cd angular
```

Tailwind:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
```

Стек (согласно [`../docs/frontend.md`](../docs/frontend.md)):

```bash
npm install ng-apexcharts apexcharts \
            lucide-angular \
            date-fns \
            @ngneat/until-destroy
```

Прокси на бэк — создать `proxy.conf.json` в корне `angular/`:

```json
{
  "/api": { "target": "http://localhost:3000", "secure": false, "changeOrigin": true },
  "/ws":  { "target": "ws://localhost:3000",  "secure": false, "ws": true }
}
```

И прописать в `angular.json` для `serve`-таргета: `"proxyConfig": "proxy.conf.json"`.

Дальше: настройка Tailwind (палитра, шрифты, темы), структура `src/app/`, базовые interceptors, environments — всё в [`../docs/frontend.md`](../docs/frontend.md) и [`../docs/ui-ux.md`](../docs/ui-ux.md). Не импровизируй с дизайн-системой — повторное приведение к общему стилю болезненно.

## Запуск (когда проект уже инициализирован)

См. [`../docs/getting-started.md`](../docs/getting-started.md#шаг-4-поднять-фронт-angular).

## Когда трогать этот README

Когда проект инициализирован — заменить этот текст на нормальный README с описанием структуры, скриптов, environments, и ссылками на документацию.

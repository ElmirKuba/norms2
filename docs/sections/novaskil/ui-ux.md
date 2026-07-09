# НоваСкил — UI/UX (Фаза 4)

> Наследует дизайн фазы 1 ([ADR-0025](../../decisions/0025-ui-ux-design-language.md)): тёмная+toggle, чистый SCSS (без Tailwind), свои компоненты, модалки `MatDialog` ([ADR-0026](../../decisions/0026-modal-system.md)). Эндпоинты — [api-contracts](./api-contracts.md). Тон «интерес не страх», accessibility-first.

## 1. Экраны (lazy feature `novaskil`)
```
/novaskil                       каталог курсов (карточки: cover, title, level, прогресс)
/novaskil/courses/:id           курс: intro, список глав, % прохождения, кнопка «Своё обучение»
/novaskil/courses/:id/ch/:cid   глава: intro + список уроков
/novaskil/lessons/:id           урок: рендер content[] (md/video/link/html), кнопка «Пройдено»
/novaskil/my                    «Моё обучение» (enrollment) — взятые курсы + прогресс
/novaskil/admin/courses         (admin) CRUD курсов
/novaskil/admin/editor/:type/:id (admin) редактор курса/главы/урока на TipTap
```
4 состояния каждого экрана: loading (скелетоны — последовательная загрузка курс→главы→уроки), empty (CTA), error (+повтор), loaded.

## 2. Рендер контента урока
- `md` → markdown-рендер; `html` → безопасный рендер (санитизация); `video` → плеер (ссылка или файл `content/`); `link` → карточка-ссылка.
- Порядок блоков = `content[]`. Кнопка «Пройдено» (идемпотентно) → обновляет прогресс, мягкий toast «Урок пройден».
- Прогресс курса/главы — вычисляется, прогресс-бар; «интерес не страх» (не «осталось N», а «пройдено N»).

## 3. Редактор (admin, TipTap)
- Один редактор для md и html, переключение визуал ↔ исходник.
- Управление структурой: курс → главы → уроки; порядок (drag/order), draft/published, теги, обложка (загрузка), вступления.
- Сохранение → `version++`, целостность ссылок (битое не публикуется).

## 4. Доступность и приём
- a11y с самого начала: клавиатура, ARIA, контраст ≥4.5, `prefers-reduced-motion`, простой язык. Видео — с подписями где возможно (волной).
- Скелетоны вместо пустых экранов; админ-функции скрыты у не-admin (по `GET /novaskil/me/roles`).

## 5. Компоненты (свои, SCSS)
CourseCard, ChapterList, LessonContentRenderer (по типам блоков), ProgressBar, SkeletonBlock, EmptyState, RoleBadge, MediaUploader (admin). Диалоги — MatDialog.

## 6. Связь с Акцентом (волной, N6)
Кнопка «добавить в Своё обучение» создаёт enrollment; в будущем — отражение курса как цели/привычки в Акценте и переход обратно. UI-связи в MVP нет, место под кнопку заложено.

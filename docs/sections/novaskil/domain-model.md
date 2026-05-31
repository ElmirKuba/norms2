# НоваСкил — доменная модель / БД (Фаза 3)

> Что хранится **в PostgreSQL** (TypeORM): роли, прогресс. Контент курсов — на диске ([content-format](./content-format.md)). Решения — [ADR-0029](../../decisions/0029-novaskil-phase3-core.md). Все id — `uuidv7___unixmillis` ([ADR-0016](../../decisions/0016-primary-key-format.md)); `created_at`/`updated_at` на всех таблицах; слой за портами ([архитектура](../../architecture.md)).

## 1. Роли (платформенные — общие, не только НоваСкил)

### `roles`
| Колонка | Тип | |
|---|---|---|
| `id` | varchar(52) | PK |
| `code` | varchar(32) | UNIQUE (`admin` | `user`) |
| `title` | varchar(64) | человекочитаемое |
| `created_at`,`updated_at` | timestamptz | |

Сидируется двумя строками: `admin`, `user`.

### `account_roles` (связь N:M аккаунт↔роль)
| Колонка | Тип | |
|---|---|---|
| `id` | varchar(52) | PK |
| `account_id` | varchar(52) | FK→accounts(id), ON DELETE RESTRICT (soft-delete фазы 1) |
| `role_id` | varchar(52) | FK→roles(id) |
| `created_at`,`updated_at` | timestamptz | |

- UNIQUE `(account_id, role_id)` — без дублей.
- Один аккаунт → 0..N ролей. Нет записи `admin` → обычный пользователь (либо явная роль `user`).
- **Проверка прав:** `isAdmin(account) := EXISTS account_roles JOIN roles ON code='admin'`. Guard `AdminGuard` на админ-эндпоинтах.
- Платформенность: таблицы общие для всей площадки (пригодятся модерации/будущим разделам). Упомянуть в `database.md` фазы 1.

## 2. Прогресс обучения

### `learning_progress`
Отметка пройденного **урока** (агрегаты курса/главы — вычисляются).
| Колонка | Тип | |
|---|---|---|
| `id` | varchar(52) | PK |
| `account_id` | varchar(52) | FK→accounts(id) |
| `course_id` | varchar(52) | id курса из JSON (НЕ FK — контент на диске) |
| `chapter_id` | varchar(52) | id главы из JSON |
| `lesson_id` | varchar(52) | id урока из JSON |
| `completed_at` | timestamptz | |
| `created_at`,`updated_at` | timestamptz | |

- UNIQUE `(account_id, lesson_id)` — идемпотентность отметки (повтор `complete` = no-op; снять = удалить запись).
- `course_id/chapter_id/lesson_id` — строки-ссылки на JSON-контент, не FK (контент вне БД, [ADR-0029](../../decisions/0029-novaskil-phase3-core.md) N3).
- Прогресс курса = `completed_lessons / total_lessons` (total — из JSON курса/глав).

### `enrollment` (задел под N6 — «Своё обучение»)
Опц. в MVP, но закладываем: какие курсы пользователь «взял к себе».
| Колонка | Тип | |
|---|---|---|
| `id` | varchar(52) | PK |
| `account_id` | varchar(52) | FK→accounts(id) |
| `course_id` | varchar(52) | id курса из JSON |
| `status` | varchar(16) | `active` | `completed` | `archived` |
| `created_at`,`updated_at` | timestamptz | |

- UNIQUE `(account_id, course_id)`. Готов к будущей связи с Акцентом (курс→Goal/Habit) без переделки — общий `account_id`, стабильный `course_id`.

## 3. Контент (НЕ в БД — на диске)
Курс/Глава/Урок и медиа — JSON+файлы в `content/` ([content-format](./content-format.md)). В БД на них только строковые ссылки (`*_id`). Версионирование, типы блоков, иерархия — там.

## 4. Порты (application-слой)
`RoleRepository`, `AccountRoleRepository` (проверка/назначение ролей), `LearningProgressRepository`, `EnrollmentRepository`, `ContentStore` (порт доступа к JSON-контенту на диске — чтение/запись курсов/глав/уроков; реализация в infrastructure, домен не знает про файлы). Сервисы: `ProgressService` (отметка/агрегация), `AdminContentService` (CRUD контента через `ContentStore`).

## 5. Связи (ER)
```
accounts ──1:N── account_roles ──N:1── roles
accounts ──1:N── learning_progress   (course/chapter/lesson_id = строки на JSON, не FK)
accounts ──1:N── enrollment          (course_id = строка на JSON)
контент (курс/глава/урок) — на диске, вне БД
```

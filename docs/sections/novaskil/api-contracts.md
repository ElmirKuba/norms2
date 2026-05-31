# НоваСкил — API-контракты (Фаза 3)

> Конвенции фазы 1: `/api/v1`, конверт ошибок `{error:{code,message}}`, zod-DTO, access-JWT ([ADR-0020](../../decisions/0020-api-conventions.md)). Все пути под `/api/v1/novaskil/...`, требуют аутентификации. Запись контента — только роль `admin` (`AdminGuard`, [domain-model](./domain-model.md)). id — `uuidv7___unixmillis`.

## 0. Auth/устройства/профиль — НЕ дублируем
Используются общие эндпоинты ЛК фазы 1 (login/refresh/logout, сессии-устройства) — [api-contracts фазы 1](../../api-contracts.md). Свой auth/devices НоваСкил не имеет ([ADR-0029](../../decisions/0029-novaskil-phase3-core.md) N1).

## 1. Роли (платформенные; админ)
- `GET /novaskil/roles` (admin) → каталог ролей.
- `GET /novaskil/accounts/:id/roles` (admin) → роли аккаунта.
- `POST /novaskil/accounts/:id/roles` (admin) Body `{ roleCode }` → назначить → 201. `DELETE /novaskil/accounts/:id/roles/:roleCode` → снять.
- `GET /novaskil/me/roles` → свои роли (для фронт-гейтов).

## 2. Курсы (чтение — все; запись — admin)
- `GET /novaskil/courses` → список (мета из `index.json`+курсов; `chapters:[fileNumber]`).
- `GET /novaskil/courses/:id` → один курс.
- `POST /novaskil/courses` (admin) → создать. `PATCH /novaskil/courses/:id` (admin). `DELETE /novaskil/courses/:id` (admin).

## 3. Главы
- `GET /novaskil/chapters?courseId=` → список. `GET /novaskil/chapters/:id`.
- `POST|PATCH|DELETE /novaskil/chapters[/:id]` (admin).

## 4. Уроки
- `GET /novaskil/lessons?chapterId=` → список. `GET /novaskil/lessons/:id` → полный объект с `content[]`.
- `POST|PATCH|DELETE /novaskil/lessons[/:id]` (admin).

> Контент создаётся/правится через `ContentStore` (файлы на диске), сервис атомарно поддерживает ссылки index↔course↔chapter↔lesson и `version++` ([content-format §7](./content-format.md)).

## 5. Прогресс
- `POST /novaskil/progress/:lessonId` → отметить пройденным (идемпотентно, uniq account+lesson).
- `DELETE /novaskil/progress/:lessonId` → снять отметку.
- `GET /novaskil/progress/course/:courseId` → `{ courseId, percent, completedLessons:[lessonId] }` (percent — сервер/фронт по total из JSON).

## 6. Своё обучение (enrollment — задел N6)
- `GET /novaskil/enrollment` → мои курсы `[{courseId,status}]`.
- `POST /novaskil/enrollment/:courseId` (`status=active`) · `PATCH /novaskil/enrollment/:courseId` (`{status}`) · `DELETE`.
- _UI-связь с Акцентом (курс→Goal/Habit) — волной; модель готова._

## 7. Медиа (загрузка — admin/профиль)
- `POST /novaskil/uploads/cover` (admin, multipart) → путь в `content/covers/`.
- `POST /novaskil/uploads/lesson-media` (admin, multipart) → путь в `content/lessons/content/`.
- Аватары — через общий профиль ЛК (если решим), хранилище — диск (N4).
- Лимиты типов/размеров — в `backend.md`/`deployment.md`.

## 8. Ошибки (поверх общих)
`FORBIDDEN` (не admin на записи), `NOT_FOUND` (нет курса/главы/урока/файла), `CONFLICT` (битая ссылочная структура при публикации), `VALIDATION_FAILED`.

# NovaSkil — Протокол разработки

> Ключевые команды в чате:
> - `прочитай из протокола` — загрузить контекст
> - `сохрани в протокол` — зафиксировать договорённости

---

## Статус: 🟢 Готово к ТЗ

---

## 1. Общая идея

Платформа для совместного обучения (изначально — для двух человек, open source — для всех).
Курсы, главы, уроки с полным CRUD. Прогресс пользователей в PostgreSQL.
Контент хранится в JSON-файлах на диске с иерархической структурой.

---

## 2. Название

**NovaSkil** (кириллица: НоваСкил)
- Нова = новый, nova
- Скил = skill (лаконично, без двойной `l`)
- Читается органично в обоих алфавитах

---

## 3. Стек ✅

| Слой | Технология |
|------|-----------|
| Frontend | Angular + TypeScript |
| Backend | NestJS |
| БД | PostgreSQL |
| ORM | Drizzle |
| Файлы курсов | Диск |
| Auth | JWT (access + refresh) |

---

## 4. Функциональность ✅

### 4.1 Контент (курсы)
- Иерархия: **Главный JSON → Курс → Глава → Урок**
- Каждый JSON-файл имеет UUID-идентификатор формата `uuidv7_unixtime13digits`
- Главный JSON файл агрегирует все курсы
- JSON файл курса ссылается на JSON файлы глав
- JSON файл главы ссылается на JSON файлы уроков
- Полный CRUD над курсами, главами, уроками — через БД и файлы
- Редактировать/добавлять/удалять контент могут только **админы**
- Редактор контента в админке: **TipTap** — один редактор для md и html, переключение между визуальным режимом и исходным кодом

### 4.2 Прогресс
- Хранится в PostgreSQL
- Фиксируется только на уровне урока
- Глава и курс считаются пройденными — вычисляется на фронте

### 4.3 Авторизация и устройства
- Регистрация / Авторизация по email + password
- Access + Refresh JWT токены
- Сессии привязаны к устройствам
- Управление устройствами:
  - Кикнуть выбранное устройство
  - Кикнуть все устройства кроме текущего
  - Админ может кикнуть устройства любого пользователя

### 4.4 МВП — исключено
- ❌ Канбан / Скрам доска
- ❌ Todo список

---

## 5. Идентификаторы ✅

Формат: `uuidv7_unixtime13digits`
Пример: `01900000-0000-7000-8000-000000000000_1714123456789`
Применяется ко всем сущностям в БД: пользователи, устройства, токены, прогресс.

---

## 6. Open Source ✅

Проект публичный, open source. Два отдельных репозитория:
- `novaskil-frontend`
- `novaskil-backend`

Документация и ТЗ оформляются в MD-файлах:
- Главный файл ссылается на подфайлы
- Подфайлы связаны между собой по необходимости
- Формат пригоден для работы Claude-агента (Claude Code)

---

## 7. Структура JSON — Урок ✅

Файл: `{fileNumber}.json` (например `42.json`)
`fileNumber`, `chapterFileNumber`, `courseFileNumber` — целые числа (система сама знает пути).
`createdAt`, `updatedAt` — unix timestamp 13 цифр (ms).
`version` — целое число, инкрементируется при обновлении.

```json
{
  "id": "uuidv7_unixtime13digits",
  "fileNumber": 42,
  "order": 1,
  "title": "Название урока",
  "description": "Краткий анонс урока",
  "status": "draft | published",
  "tags": ["angular", "typescript"],
  "version": 1,
  "createdAt": 1714123456789,
  "updatedAt": 1714123456789,
  "content": [
    { "type": "md", "src": "content/lessons/content/intro.md" },
    { "type": "video", "src": "https://..." },
    { "type": "link", "src": "https://docs.angular.io" },
    { "type": "html", "src": "content/lessons/content/exercise.html" }
  ],
  "chapterId": "uuidv7_unixtime13digits",
  "chapterFileNumber": 3,
  "courseId": "uuidv7_unixtime13digits",
  "courseFileNumber": 1
}
```

Типы контента: `md`, `video`, `link`, `html` (расширяемый массив объектов).
Контент — массив объектов `{ type, src }`, порядок соответствует порядку отображения.

---

## 8. Структура JSON — Глава ✅

Файл: `{fileNumber}.json` (например `3.json`)
`intro` — не массив, одиночный объект. Только `md` или `html`.
`lessons` — массив целых чисел (fileNumber уроков), система сама знает папку.

```json
{
  "id": "uuidv7_unixtime13digits",
  "fileNumber": 3,
  "order": 2,
  "title": "Название главы",
  "description": "Краткий анонс главы",
  "status": "draft | published",
  "tags": ["javascript", "basics"],
  "version": 1,
  "createdAt": 1714123456789,
  "updatedAt": 1714123456789,
  "intro": {
    "type": "md | html",
    "src": "content/chapters/intro/3.md"
  },
  "lessons": [1, 5, 12, 42],
  "courseId": "uuidv7_unixtime13digits",
  "courseFileNumber": 1
}
```

---

## 9. Структура JSON — Курс ✅

Файл: `{fileNumber}.json` (например `1.json`)
`chapters` — массив целых чисел (fileNumber глав).
`prerequisites` — массив fileNumber других курсов, рекомендованных перед этим.
`authorId` — UUID пользователя-админа из таблицы пользователей БД.
`cover` — относительный путь к изображению обложки.
`certificate` — boolean, выдаётся ли сертификат по окончании.

```json
{
  "id": "uuidv7_unixtime13digits",
  "fileNumber": 1,
  "order": 1,
  "title": "JavaScript с нуля до трудоустройства",
  "description": "Краткий анонс курса",
  "status": "draft | published",
  "tags": ["javascript", "frontend"],
  "level": "beginner | intermediate | advanced",
  "lang": "ru | en",
  "authorId": "uuidv7_unixtime13digits",
  "version": 1,
  "createdAt": 1714123456789,
  "updatedAt": 1714123456789,
  "intro": {
    "type": "md | html",
    "src": "content/courses/intro/1.md"
  },
  "cover": "content/covers/1.jpg",
  "chapters": [1, 2, 3, 7],
  "prerequisites": [1, 2],
  "certificate": false
}
```

---

## 10. Структура JSON — Главный файл ✅

Файл: `index.json` — точка входа всей платформы.
`formatVersion` — версия схемы JSON файлов, для проверки совместимости при чтении.
`version` — версия самого файла, инкрементируется при обновлении.
`courses` — массив fileNumber всех курсов.

```json
{
  "formatVersion": 1,
  "version": 1,
  "updatedAt": 1714123456789,
  "courses": [1, 2, 3]
}
```

---

## 11. Структура папок на диске ✅

```
content/
├── index.json
├── avatars/          ← аватарки пользователей
│   └── uuid.jpg
├── covers/           ← обложки курсов
│   └── 1.jpg
├── courses/
│   ├── 1.json
│   ├── 2.json
│   └── intro/
│       └── 1.md
├── chapters/
│   ├── 1.json
│   ├── 2.json
│   └── intro/
│       └── 1.md
└── lessons/
    ├── 1.json
    ├── 42.json
    └── content/
        ├── intro.md
        └── exercise.html
```

NestJS раздаёт всю папку `content/` как статику через `ServeStaticModule`.
Фронт подставляет путь напрямую в `src` атрибут `<img>`, браузер забирает GET запросом.

---

## 12. Роли пользователей ✅

Только два уровня: `admin` и `user`.
- `admin` — полный CRUD над контентом, управление пользователями
- `user` — только чтение и прогресс

---

## 13. Схема БД ✅

### users
```
id            uuidv7_unixtime13digits  PK
email         varchar                  unique
password      varchar                  hashed
display_name  varchar                  псевдоним (не уникальный, только отображение)
avatar        varchar                  путь к файлу (content/avatars/uuid.jpg)
role          enum(admin, user)
is_active     boolean                  default true
created_at    bigint                   unix ms
updated_at    bigint                   unix ms
```

### devices
```
id            uuidv7_unixtime13digits  PK
user_id       uuidv7_unixtime13digits  FK → users.id
name          varchar                  системное имя устройства
created_at    bigint                   unix ms
last_seen_at  bigint                   unix ms
```

### refresh_tokens
```
id            uuidv7_unixtime13digits  PK
user_id       uuidv7_unixtime13digits  FK → users.id
device_id     uuidv7_unixtime13digits  FK → devices.id
token         varchar                  hashed
expires_at    bigint                   unix ms
created_at    bigint                   unix ms
```

### progress
```
id            uuidv7_unixtime13digits  PK
user_id       uuidv7_unixtime13digits  FK → users.id
course_id     varchar                  id курса из JSON
chapter_id    varchar                  id главы из JSON
lesson_id     varchar                  id урока из JSON
completed_at  bigint                   unix ms
```

**Примечания:**
- `course_id`, `chapter_id`, `lesson_id` — строки, не FK (данные в JSON файлах, не в БД)
- Прогресс фиксируется только на уровне урока; глава и курс вычисляются на лету на фронте
- Refresh токены хранятся хешированными; при кике устройства — запись удаляется

---

## 14. API контракты — Auth ✅

```
POST /auth/register    — регистрация (email, password, displayName)
POST /auth/login       — логин → токены [+ профиль если getProfile: true]
POST /auth/logout      — логаут текущего устройства
POST /auth/refresh     — refresh токен → новый access токен
GET  /users/me         — получить профиль текущего пользователя
```

### POST /auth/register
Request:
```json
{ "email": "user@example.com", "password": "...", "displayName": "Максим Горький" }
```
Response: `201 Created` (без токенов — логин отдельно)

### POST /auth/login
Request:
```json
{ "email": "user@example.com", "password": "...", "getProfile": true }
```
Response:
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "profile": {
    "id": "uuidv7_unixtime13digits",
    "email": "user@example.com",
    "displayName": "Максим Горький",
    "avatar": "content/avatars/uuid.jpg",
    "role": "user"
  }
}
```
`profile` — только если `getProfile: true`, иначе поле отсутствует.

### GET /users/me
Response:
```json
{
  "id": "uuidv7_unixtime13digits",
  "email": "user@example.com",
  "displayName": "Максим Горький",
  "avatar": "content/avatars/uuid.jpg",
  "role": "user"
}
```

---

## 15. API контракты — Devices ✅

### Пользователь — свои устройства
```
GET    /devices                      — список своих устройств
DELETE /devices/:id                  — кикнуть конкретное устройство
DELETE /devices/all-except-current   — кикнуть все кроме текущего
```

### Админ — устройства любого пользователя
```
GET    /admin/users/:userId/devices          — список устройств пользователя
DELETE /admin/users/:userId/devices/:id      — кикнуть конкретное устройство
DELETE /admin/users/:userId/devices          — кикнуть все устройства пользователя
```

### GET /devices response:
```json
[
  {
    "id": "uuidv7_unixtime13digits",
    "name": "iPhone 15 Pro",
    "lastSeenAt": 1714123456789,
    "isCurrent": true
  }
]
```

---

## 16. API контракты — Courses / Chapters / Lessons ✅

### Принципы
- Плоские маршруты (не вложенные)
- Каждый эндпоинт отвечает только в рамках своей предметной области
- Фронт загружает данные последовательно: курс → главы → уроки
- Пока грузит — показывает скелетон анимацию

### Courses
```
GET    /courses              — список всех курсов
GET    /courses/:id          — один курс (chapters: [1, 2, 3] — только числа)
POST   /courses              — создать (admin)
PATCH  /courses/:id          — обновить (admin)
DELETE /courses/:id          — удалить (admin)
```

### Chapters
```
GET    /chapters             — список глав (?courseId=... для фильтрации)
GET    /chapters/:id         — одна глава (lessons: [1, 5, 42] — только числа)
POST   /chapters             — создать (admin)
PATCH  /chapters/:id         — обновить (admin)
DELETE /chapters/:id         — удалить (admin)
```

### Lessons
```
GET    /lessons              — список уроков (?chapterId=... для фильтрации)
GET    /lessons/:id          — один урок (полный объект с content)
POST   /lessons              — создать (admin)
PATCH  /lessons/:id          — обновить (admin)
DELETE /lessons/:id          — удалить (admin)
```

---

## 17. API контракты — Progress ✅

```
POST   /progress/:lessonId            — отметить урок пройденным
DELETE /progress/:lessonId            — снять отметку
GET    /progress/course/:courseId     — прогресс по курсу
```

### GET /progress/course/:courseId response:
```json
{
  "courseId": "...",
  "percent": 42,
  "completedLessons": ["lessonId1", "lessonId2"]
}
```

---

## 18. API контракты — Users ✅

### Пользователь — свой профиль
```
PATCH  /users/me           — обновить displayName, email, password
POST   /users/me/avatar    — загрузить аватарку (multipart/form-data)
DELETE /users/me/avatar    — удалить аватарку
```

### Админ — управление пользователями
```
GET    /admin/users        — список всех пользователей
PATCH  /admin/users/:id    — изменить role, is_active
```

---

## 19. Структура NestJS проекта ✅

### Архитектура — 4 слоя
- `controller` — HTTP, валидация входа
- `service` — бизнес логика
- `repository.interface.ts` — контракт репозитория
- `repository.ts` — реализация через Drizzle

Смена ORM = новый файл реализации + одна строка в модуле. Сервис не трогается.

```
src/
├── main.ts
├── app.module.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.repository.interface.ts
│   ├── auth.repository.ts
│   ├── dto/
│   │   ├── register.dto.ts
│   │   └── login.dto.ts
│   └── strategies/
│       ├── jwt.strategy.ts
│       └── refresh.strategy.ts
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.repository.interface.ts
│   ├── users.repository.ts
│   └── dto/
│       └── update-user.dto.ts
├── devices/
│   ├── devices.module.ts
│   ├── devices.controller.ts
│   ├── devices.service.ts
│   ├── devices.repository.interface.ts
│   ├── devices.repository.ts
│   └── dto/
├── courses/
│   ├── courses.module.ts
│   ├── courses.controller.ts
│   ├── courses.service.ts
│   ├── courses.repository.interface.ts
│   ├── courses.repository.ts
│   └── dto/
├── chapters/
│   ├── chapters.module.ts
│   ├── chapters.controller.ts
│   ├── chapters.service.ts
│   ├── chapters.repository.interface.ts
│   ├── chapters.repository.ts
│   └── dto/
├── lessons/
│   ├── lessons.module.ts
│   ├── lessons.controller.ts
│   ├── lessons.service.ts
│   ├── lessons.repository.interface.ts
│   ├── lessons.repository.ts
│   └── dto/
├── progress/
│   ├── progress.module.ts
│   ├── progress.controller.ts
│   ├── progress.service.ts
│   ├── progress.repository.interface.ts
│   ├── progress.repository.ts
│   └── dto/
├── db/
│   ├── schema.ts
│   └── db.module.ts
└── common/
    ├── guards/
    │   ├── jwt.guard.ts
    │   └── admin.guard.ts
    └── decorators/
        └── current-user.decorator.ts
```

---

## 20. Структура Angular проекта ✅

### Принципы
- Standalone компоненты везде, без NgModule
- Стейт менеджмент — сервисы + Angular signals (`signal`, `computed`)
- Без NgRx — overhead для данного масштаба

```
src/
├── main.ts
├── app/
│   ├── app.component.ts
│   ├── app.config.ts
│   ├── app.routes.ts
│   ├── core/
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── users.service.ts
│   │   │   ├── devices.service.ts
│   │   │   ├── courses.service.ts
│   │   │   ├── chapters.service.ts
│   │   │   ├── lessons.service.ts
│   │   │   └── progress.service.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   └── admin.guard.ts
│   │   ├── interceptors/
│   │   │   └── auth.interceptor.ts
│   │   └── models/
│   │       ├── user.model.ts
│   │       ├── course.model.ts
│   │       ├── chapter.model.ts
│   │       └── lesson.model.ts
│   ├── features/
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   ├── login.component.ts
│   │   │   │   └── login.component.html
│   │   │   └── register/
│   │   │       ├── register.component.ts
│   │   │       └── register.component.html
│   │   ├── courses/
│   │   │   ├── courses-list/
│   │   │   ├── course-detail/
│   │   │   ├── chapter-detail/
│   │   │   └── lesson-detail/
│   │   ├── profile/
│   │   │   └── profile/
│   │   └── admin/
│   │       ├── users/
│   │       ├── course-editor/
│   │       ├── chapter-editor/
│   │       └── lesson-editor/
│   └── shared/
│       ├── components/
│       │   ├── skeleton/
│       │   └── avatar/
│       └── pipes/
```

---

## 21. Всё решено ✅

- [x] Название — NovaSkil
- [x] Стек — Angular, NestJS, PostgreSQL, Drizzle
- [x] Репозитории — два отдельных (novaskil-frontend, novaskil-backend)
- [x] Структура JSON урока, главы, курса, index.json
- [x] Структура папок на диске
- [x] Роли пользователей (admin, user)
- [x] Схема БД (users, devices, refresh_tokens, progress)
- [x] API auth, devices, courses, chapters, lessons, progress, users
- [x] Структура NestJS (4 слоя)
- [x] Структура Angular (standalone + signals)
- [x] Редактор контента — TipTap
- [x] МВП без канбан и todo

---

*Последнее обновление: сессия 1 — протокол завершён, готов к генерации ТЗ*

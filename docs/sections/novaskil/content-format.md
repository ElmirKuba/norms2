# НоваСкил — формат контента на диске (Фаза 3)

> Контент курсов хранится **файлами на диске** (не в БД) — [ADR-0029](../../decisions/0029-novaskil-phase3-core.md) N3/N4. В БД — только роли и прогресс ([domain-model](./domain-model.md)). Иерархия: `index.json → Курс → Глава → Урок`. Доступ из домена — через порт `ContentStore` (домен не знает про файлы).

## 1. Структура папок
```
content/
├── index.json              ← точка входа, список курсов
├── avatars/  uuid.jpg      ← аватары пользователей (медиа, N4)
├── covers/   1.jpg         ← обложки курсов
├── courses/
│   ├── 1.json              ← курс (fileNumber.json)
│   └── intro/ 1.md         ← вступления курсов
├── chapters/
│   ├── 3.json              ← глава
│   └── intro/ 3.md
└── lessons/
    ├── 42.json             ← урок
    └── content/            ← тело уроков (md/html), картинки
        ├── intro.md
        └── exercise.html
```
NestJS раздаёт `content/` статикой; фронт подставляет `src` напрямую. Бэкапы (`deployment.md`) учитывают папку `content/`.

## 2. Конвенции
- **id сущности** — наш формат `uuidv7___unixmillis` ([ADR-0016](../../decisions/0016-primary-key-format.md); НЕ протокольный с одним `_`).
- **fileNumber** — целое, имя файла (`42.json`); система знает папку по типу. Ссылки между уровнями — массивы fileNumber.
- `createdAt`/`updatedAt` — unix ms (13 цифр). `version` — int, ++ при правке. `order` — порядок. `status` — `draft|published`. `tags[]`.
- Контент-блоки урока — упорядоченный массив `{type, src}`, типы: **`md` | `video` | `link` | `html`** (все в MVP, N8; массив расширяем).

## 3. `index.json`
```json
{ "formatVersion": 1, "version": 1, "updatedAt": 1714123456789, "courses": [1, 2, 3] }
```
`formatVersion` — версия схемы (проверка совместимости при чтении). `courses` — fileNumber всех курсов.

## 4. Курс — `courses/{fileNumber}.json`
```json
{
  "id": "uuidv7___unixmillis", "fileNumber": 1, "order": 1,
  "title": "...", "description": "...", "status": "draft|published",
  "tags": ["js"], "level": "beginner|intermediate|advanced", "lang": "ru|en",
  "authorId": "<account.id админа-автора>",
  "version": 1, "createdAt": 0, "updatedAt": 0,
  "intro": { "type": "md|html", "src": "content/courses/intro/1.md" },
  "cover": "content/covers/1.jpg",
  "chapters": [1, 2, 3],
  "prerequisites": [],
  "certificate": false
}
```
`authorId` — id аккаунта-админа (из БД). `prerequisites` — fileNumber рекомендованных курсов. `certificate` — bool (выдача — волной).

## 5. Глава — `chapters/{fileNumber}.json`
```json
{
  "id": "uuidv7___unixmillis", "fileNumber": 3, "order": 2,
  "title": "...", "description": "...", "status": "draft|published",
  "tags": [], "version": 1, "createdAt": 0, "updatedAt": 0,
  "intro": { "type": "md|html", "src": "content/chapters/intro/3.md" },
  "lessons": [1, 5, 42],
  "courseId": "<course.id>", "courseFileNumber": 1
}
```
`intro` — одиночный объект (md|html). `lessons` — fileNumber уроков.

## 6. Урок — `lessons/{fileNumber}.json`
```json
{
  "id": "uuidv7___unixmillis", "fileNumber": 42, "order": 1,
  "title": "...", "description": "...", "status": "draft|published",
  "tags": [], "version": 1, "createdAt": 0, "updatedAt": 0,
  "content": [
    { "type": "md",    "src": "content/lessons/content/intro.md" },
    { "type": "video", "src": "https://... | content/lessons/content/clip.mp4" },
    { "type": "link",  "src": "https://docs..." },
    { "type": "html",  "src": "content/lessons/content/exercise.html" }
  ],
  "chapterId": "<chapter.id>", "chapterFileNumber": 3,
  "courseId": "<course.id>",  "courseFileNumber": 1
}
```
Порядок блоков `content[]` = порядок отображения. `video` — внешняя ссылка ИЛИ файл на диске (N4).

## 7. CRUD и согласованность
- Правит только `admin` (через `ContentStore` + редактор TipTap). Создание/изменение/удаление обновляет связанные ссылки (course.chapters, chapter.lessons, index.courses) **атомарно** на уровне сервиса; `version++`, `updatedAt`.
- Целостность ссылок — ответственность `AdminContentService`; битые ссылки не публикуются (`status=published` только при валидной структуре).
- Прогресс в БД ссылается на `id` урока/главы/курса (строки) — при удалении контента записи прогресса остаются (история), помечаются «контент удалён» на чтении.

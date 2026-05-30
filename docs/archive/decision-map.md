# decision-map.md — карта решений по проекту «Нормисы»

> **Назначение.** Реестр всех точек решения по фазе 1 и их статус. «Почему» — в [`decisions/`](../decisions/README.md) (ADR), «что строим» — в reference-доках (`database.md`, `domain-model.md`, и т.д.).
>
> **Статус файла:** это «леса» фазы решений. **Все решения фазы 1 закрыты.** После приёмки спека файл можно архивировать — он остаётся как лёгкий индекс «какой ADR/док что закрыл».

## Легенда
✅ решено · ⏸️ сознательно отложено (до деплоя/будущей фазы)

## Текущая позиция
- **Все блоки A–K по фазе 1 закрыты.** 26 ADR + 11 reference-доков, спек непротиворечив (проверено).
- Открытых решений по фазе 1 нет. Отложенные (⏸️) — только то, что по смыслу делается позже (ревью юриста и текст политики — к деплою; блок L — будущие фазы).
- Следующий шаг проекта — **реализация фазы 1** (Sonnet) по reference-докам.

---

## A. Концепт / философия
| ID | Точка | Статус | Где закрыто |
|---|---|---|---|
| A1 тон | ламповое/мемное закрытое сообщество | ✅ | [ADR-0022](../decisions/0022-concept-and-philosophy.md) |
| A2 закрытость | invite-only всегда в проде | ✅ | ADR-0022 |
| A3 языки | RU (фаза 1), i18n-структура заложена | ✅ | ADR-0022 |
| A4 монетизация | некоммерческий, донаты позже | ✅ | ADR-0022 |
| A5 админ-роль | отложена; первый повод — override квоты | ✅ (решение: отложить) | ADR-0022 |
| A6 профиль | единый на все разделы | ✅ | ADR-0022, [TA](../../Technical-assignment.md) |

## B. Приватность / 152-ФЗ
| ID | Точка | Статус | Где закрыто |
|---|---|---|---|
| B1 статус оператора | минимизация ПДн | ✅ | [ADR-0001](../decisions/0001-data-minimization-no-pii.md) |
| B2 чёрный список тем | зафиксирован | ✅ | [ADR-0006](../decisions/0006-registration-field-rules.md) |
| B3 IP-логи: соль/sweep | соль в конфиге, sweep nest-schedule | ✅ | [ADR-0023](../decisions/0023-deployment-jurisdiction.md) |
| B4 cookie | блокирующий гейт | ✅ | [ADR-0024](../decisions/0024-cookie-consent-gate.md) |
| B5 Privacy Policy текст | финал — к деплою (фаза 1.9) | ⏸️ | 152fz (приватный) |
| B6 backup-домен | покупка позже/под давлением | ⏸️ | ADR-0023 |
| — ревью юриста | перед боевым деплоем | ⏸️ | 152fz |

## C. Архитектура backend
| ID | Точка | Статус | Где закрыто |
|---|---|---|---|
| C1 стор токенов | таблица `sessions` в Postgres | ✅ | [ADR-0018](../decisions/0018-refresh-tokens-sessions.md) |
| C2–C8 репо/конфиг/shared/ошибки/логи/идемпотентность | монорепо, zod, pino, unique-идемпотентность | ✅ | [ADR-0019](../decisions/0019-backend-architecture-conventions.md), [architecture.md](../architecture.md) |

## D. Доменная модель
| ID | Точка | Статус | Где закрыто |
|---|---|---|---|
| D1 структура User | раздельные сущности; пароль в `accounts` | ✅ | [ADR-0005](../decisions/0005-user-split-entities.md), [ADR-0011](../decisions/0011-accounts-table-merge-rename.md) |
| D2 дерево инвайтов | таблица `invitations` (порт+CTE) | ✅ | [ADR-0002](../decisions/0002-invite-tree-adjacency.md), [ADR-0014](../decisions/0014-invitation-edge-table.md) |
| D3 семантика бана | OR-эффект, без каскада, только свой | ✅ | [ADR-0003](../decisions/0003-ban-semantics.md) |
| D4 инвайты | счётчик-квота, TTL, отзыв | ✅ | [ADR-0007](../decisions/0007-invite-quota-counter.md), [ADR-0004](../decisions/0004-invite-quota-ttl.md) |
| D5 alias / D6 login | правила валидации | ✅ | [ADR-0006](../decisions/0006-registration-field-rules.md) |
| D7 SecretQA | в настройках, 1:N, K-of-N | ✅ | [ADR-0008](../decisions/0008-account-recovery-secret-questions.md) |
| D8 статусы/удаление | soft-delete + деактивация | ✅ | [ADR-0017](../decisions/0017-account-soft-delete.md) |

## E. База данных
| ID | Точка | Статус | Где закрыто |
|---|---|---|---|
| E1 конвенции/PK | id `uuidv7___unixmillis`, created/updated_at | ✅ | [ADR-0016](../decisions/0016-primary-key-format.md), [ADR-0011](../decisions/0011-accounts-table-merge-rename.md) |
| E2 soft vs hard delete | soft-delete | ✅ | [ADR-0017](../decisions/0017-account-soft-delete.md) |
| E3 миграции | явные TypeORM, up/down | ✅ | [database.md](../database.md) |
| E4 хранение дерева | таблица `invitations` | ✅ | [ADR-0014](../decisions/0014-invitation-edge-table.md) |
| E5 индексы | login uniq (lower), code uniq, и т.д. | ✅ | [database.md](../database.md) |
| E6 security_logs | схема, TTL 60д, без FK | ✅ | [database.md](../database.md), [ADR-0001](../decisions/0001-data-minimization-no-pii.md) |
| E7 хеширование | argon2id на бэке | ✅ | [ADR-0009](../decisions/0009-server-side-hashing.md) |
| E8 PG-расширения | uuid app-side, argon2 в коде, sweep nest-schedule (pg_cron не нужен) | ✅ | [ADR-0023](../decisions/0023-deployment-jurisdiction.md), database.md |

## F. API-контракты
| ID | Точка | Статус | Где закрыто |
|---|---|---|---|
| F1–F7 версия/формат/эндпоинты/пагинация/rate-limit/DTO/токены | всё зафиксировано | ✅ | [ADR-0010](../decisions/0010-registration-auth-flow.md), [ADR-0020](../decisions/0020-api-conventions.md), [api-contracts.md](../api-contracts.md) |

## G. Backend-правила
| ID | Точка | Статус | Где закрыто |
|---|---|---|---|
| G1–G4 структура/тесты/версии/DI | зафиксировано | ✅ | [backend.md](../backend.md), [ADR-0021](../decisions/0021-tooling-defaults.md) |

## H. Frontend-правила
| ID | Точка | Статус | Где закрыто |
|---|---|---|---|
| H1–H4 версии/state/HTTP/формы | зафиксировано | ✅ | [frontend.md](../frontend.md), [ADR-0020](../decisions/0020-api-conventions.md), [ADR-0021](../decisions/0021-tooling-defaults.md) |
| H5 стили/токены | SCSS-переменные (без Tailwind) | ✅ | [ADR-0025](../decisions/0025-ui-ux-design-language.md) |
| H6 i18n | RU фаза 1 | ✅ | [ADR-0022](../decisions/0022-concept-and-philosophy.md) |

## I. UI/UX
| ID | Точка | Статус | Где закрыто |
|---|---|---|---|
| I1–I3 тема/вайб/компоненты | тёмная+toggle, минимал, свои SCSS | ✅ | [ADR-0025](../decisions/0025-ui-ux-design-language.md), [ui-ux.md](../ui-ux.md) |
| I-модалки | MatDialog, конфигурируемый shell | ✅ | [ADR-0026](../decisions/0026-modal-system.md) |

## J. Деплой
| ID | Точка | Статус | Где закрыто |
|---|---|---|---|
| J1 юрисдикция/VPS | РФ на время разработки, переезд под давлением | ✅ | [ADR-0023](../decisions/0023-deployment-jurisdiction.md) |
| J2 reverse-proxy/TLS | Traefik + Let's Encrypt | ✅ | ADR-0023, [deployment.md](../deployment.md) |
| J3–J8 TLS/ENV/бэкапы/sweep/миграции | зафиксировано | ✅ | deployment.md |

## K. Локальный запуск
| ID | Точка | Статус | Где закрыто |
|---|---|---|---|
| K1–K2 docker-compose.dev/.env/требования | зафиксировано | ✅ | [getting-started.md](../getting-started.md) |

## L. Будущие фазы и фундамент
| ID | Точка | Статус |
|---|---|---|
| L1 Акцент (scope) | ⏸️ фаза 2 |
| L2 НоваСкил (+CoT/ToT/SC как механика) | ⏸️ фаза 3 |
| L3 облачный мессенджер (крипта в БД) | ⏸️ фаза 4 |
| L4 e2e-мессенджер | ⏸️ фаза 5 |
| L5 Native (Capacitor+Electron) | ⏸️ фаза 6 |
| L6 опциональный email | ⏸️ после фазы 1 |
| L7 git init + первый коммит | ✅ сделано |

---

## Что осталось по самой доке
- ✅ Файл перенесён в `docs/archive/` (фаза 0 завершена).
- ADR — **оставлены** (хранят «почему», в reference-доках их нет).

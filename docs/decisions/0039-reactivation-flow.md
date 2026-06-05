# ADR-0039: Реактивация деактивированного — login сигналит, публичный credential-эндпоинт

- **Статус:** accepted
- **Дата:** 2026-06-05
- **Решает:** Elmir (+ Claude Code, развилка при R2.3)
- **Контекст-теги:** [domain] [backend] [api]
- Уточняет: [ADR-0017](./0017-account-soft-delete.md) («флоу реактивации при входе»).

## Контекст

Деактивация — обратимая само-пауза (ADR-0017). Но деактивированный аккаунт **не проходит Guard** (`getActiveById` отвергает deactivated), поэтому эндпоинт реактивации под Guard недостижим. Нужен путь, доступный именно деактивированному пользователю, и сценарий, как он туда попадает.

## Решение

- **`login` различает деактивацию.** При верных учётных данных, но `deactivated_at != null`, `authenticate` бросает `AccountDeactivatedError` (403, `ACCOUNT_DEACTIVATED`) — отдельно от единого 401 `BAD_CREDENTIALS`. Удалённый (`deleted_at`) остаётся терминальным 401 (не раскрываем). Раскрытие deactivated безопасно — только владельцу (после верного пароля).
- **Публичный `POST /auth/reactivate` {login, password}** (без Guard). `authenticateForReactivation` проверяет пароль, допускает деактивированного (но не удалённого), затем `reactivate` снимает `deactivated_at` (CAS). Токенов не выдаёт — после успеха обычный `login`.
- **Само-действия под Guard:** `POST /accounts/me/deactivate`, `DELETE /accounts/me` (soft-delete) — в `ProfileModule`.

Флоу: login → 403 `ACCOUNT_DEACTIVATED` → фронт предлагает «реактивировать?» → `POST /auth/reactivate` → login.

## Альтернативы

- **Реактивация под Guard.** Недостижима (деактивированный не проходит Guard). Отвергнуто.
- **login отдаёт общий 401 для deactivated.** Плохой UX: пользователь не узнает, что нужно реактивировать (ADR-0017 требует «флоу при входе»). Отвергнуто.
- **Авто-реактивация при успешном login деактивированного.** Снимает паузу без явного согласия — пауза перестаёт быть осознанной. Отвергнуто.

## Последствия

- `api-contracts.md`: `POST /auth/login` может вернуть 403 `ACCOUNT_DEACTIVATED`; новый публичный `POST /auth/reactivate`; `POST /accounts/me/deactivate`, `DELETE /accounts/me`.
- `AccountDomainService`: `authenticate` (deactivated→403), `authenticateForReactivation`, `deactivate`/`reactivate`/`softDelete` (через CAS `_applyWithRetry`).
- TODO: после deactivate/delete отозвать refresh-сессии (R3).

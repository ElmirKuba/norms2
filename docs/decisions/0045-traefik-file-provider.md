# ADR-0045: Traefik — file-провайдер вместо docker-провайдера (без docker.sock)

- Статус: принято (2026-06-11, D1.3)
- Контекст: фаза 1, D1.3 (локальный прогон прод-стека). Черновик прод-роутинга был
  на **docker-провайдере** Traefik (маршруты через лейблы контейнеров + монтирование
  `/var/run/docker.sock` в Traefik). Всплыли две проблемы:
  1. **Не работает на этом демоне.** Docker (Desktop, macOS) поднял `MinAPIVersion`
     до **1.40**, а docker-клиент Traefik négocie **1.24** и не умеет подняться →
     `client version 1.24 is too old` на каждый запрос, лейблы не читаются, роутеры
     не открываются (404 на всё). `DOCKER_API_VERSION` Traefik игнорирует; апгрейд
     Traefik v3.3→v3.5 не помог. На обычном Linux-VPS docker-провайдер бы работал,
     но завязываться на квирки демона не хочется.
  2. **Безопасность.** Монтировать `docker.sock` (даже ro) в интернет-facing прокси —
     это доступ к Docker API = фактически root на хосте при компрометации Traefik.

## Развилка (ToT)

| Ветвь | Суть | Минус |
|---|---|---|
| A. docker-провайдер (как было) | лейблы + автодискавери | нужен `docker.sock` (риск); сломан на этом демоне |
| B. socket-proxy перед Traefik | ограничить docker API | не чинит негоциацию версии (запрос всё равно 1.24); +сервис |
| **C. file-провайдер** | явный конфиг маршрутов, без docker.sock | маршруты не автодискаверятся (для фикс-стека норм) |

## Решение

**Ветвь C — file-провайдер.** Маршруты — в `docker/traefik/dynamic/routes.yml`
(монтируется ro в Traefik); `--providers.file.directory`, без docker-провайдера и без
`docker.sock`. Same-origin path-based:

- `norms2-api`: `PathPrefix(/api) || PathPrefix(/content)` priority 10 → `norms2_nest_prod:3000`;
- `norms2-web`: `PathPrefix(/)` priority 1 → `norms2_angular_prod:80` (SPA).

Сервисы адресуются по `container_name` в общей сети. TLS — дефолт entrypoint
`websecure`: серт для `${DOMAIN}` (compose-интерполяция) через ACME; локально ACME
не выпишет example.com → Traefik отдаёт встроенный self-signed (D1.3 на нём и гоняли).
Лейблы `traefik.*` с nest/angular убраны.

## Последствия

- **Нет `docker.sock` в прокси** — снят вектор «компрометация Traefik → root на хосте».
- **Не зависит от версии docker-API демона** — одинаково локально (macOS) и на VPS.
- Маршруты явные и ревьюабельны; при добавлении сервиса — правка `routes.yml` (для
  небольшого фикс-стека это плюс, а не минус).
- Домен для серта задаётся флагом entrypoint `--entrypoints.websecure.http.tls.domains[0].main=${DOMAIN}`
  (не в лейблах). Боевой LE-серт — на D1.4 (реальный домен/сервер).
- D1.3 на self-signed пройден: http→https, SPA→angular, `/api` и `/content`→nest,
  релиз-нота из сида, `GET /version`, login по HTTPS (HTTP/2 200 + refresh-cookie).

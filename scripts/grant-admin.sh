#!/usr/bin/env bash
# Выдать роль администратора существующему аккаунту «Нормисов».
#
# Зачем скрипт, а не переменная окружения. Раньше первый админ назначался списком логинов в
# `ADMIN_LOGINS`, и это тащило конкретный логин в конфиг открытого проекта. Здесь логин вводит
# тот, кто запускает, — в репозитории не остаётся ничьих имён.
#
# Что делает: заходит в работающий контейнер PostgreSQL и выполняет SQL. Аккаунт должен уже
# существовать — роль выдаётся человеку, а не создаёт его.
#
# Запуск:  ./scripts/grant-admin.sh          (спросит окружение и логин)
#          ./scripts/grant-admin.sh <логин>  (спросит только окружение, если их два)
set -euo pipefail

DB_USER="${DB_USER:-norms2}"
DB_NAME="${DB_NAME:-norms2}"

say() { printf '%s\n' "$*"; }
die() { printf 'Ошибка: %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "docker не найден в PATH."

# ── выбор контейнера ──────────────────────────────────────────────────────────
running=()
for name in norms2_postgres_dev norms2_postgres_prod; do
  if docker ps --format '{{.Names}}' | grep -qx "$name"; then running+=("$name"); fi
done

case "${#running[@]}" in
  0) die "Не найден работающий контейнер БД (norms2_postgres_dev или norms2_postgres_prod).
       Поднимите окружение: make dev-up (локально) или make prod-up (на сервере)." ;;
  1) container="${running[0]}" ;;
  *)
    say "Найдено несколько окружений:"
    for i in "${!running[@]}"; do say "  $((i + 1))) ${running[$i]}"; done
    read -r -p "Куда выдаём права? [1-${#running[@]}]: " choice
    [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#running[@]} )) \
      || die "Нужен номер от 1 до ${#running[@]}."
    container="${running[$((choice - 1))]}"
    ;;
esac
say "Окружение: $container"

# ── аккаунт должен уже существовать ───────────────────────────────────────────
say ""
say "Роль выдаётся СУЩЕСТВУЮЩЕМУ аккаунту: сначала зарегистрируйтесь в «Нормисах»,"
say "и только потом запускайте этот скрипт."
read -r -p "Аккаунт уже зарегистрирован? [y/N]: " registered
case "${registered,,}" in
  y|yes|д|да) ;;
  *) say "Тогда сначала регистрация — и запустите скрипт снова."; exit 0 ;;
esac

login="${1:-}"
if [ -z "$login" ]; then
  read -r -p "Логин аккаунта: " login
fi
login="$(printf '%s' "$login" | tr -d '[:space:]')"
[ -n "$login" ] || die "Логин пустой."

# ── SQL ───────────────────────────────────────────────────────────────────────
# Текст запроса общий с grant-admin.cmd — лежит рядом в grant-admin.sql, чтобы две копии
# однажды не разъехались.
sql_file="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/grant-admin.sql"
[ -f "$sql_file" ] || die "Не найден $sql_file"

docker exec -i -e PGOPTIONS='--client-min-messages=notice' \
  "$container" psql -U "$DB_USER" -d "$DB_NAME" -v "login=$login" -q < "$sql_file"

say ""
say "Текущие роли:"
docker exec -i "$container" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
  "select a.login || ' → ' || coalesce(string_agg(r.code, ' + ' order by r.code), '(ролей нет)')
     from accounts a
     left join account_roles ar on ar.account_id = a.id
     left join roles r on r.id = ar.role_id
    where lower(a.login) = lower('$login')
    group by a.login;"

say ""
say "Готово. Права действуют сразу — перезапуск не нужен, роль читается на каждом запросе."

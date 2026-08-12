@echo off
rem Выдать роль администратора существующему аккаунту «Нормисов» (Windows).
rem
rem Тот же смысл, что у grant-admin.sh: логин вводит запускающий, в репозитории не остаётся
rem ничьих имён. Аккаунт должен уже существовать — скрипт выдаёт роль, а не заводит человека.
rem
rem Запуск:  scripts\grant-admin.cmd          (спросит окружение и логин)
rem          scripts\grant-admin.cmd <логин>
setlocal EnableDelayedExpansion
chcp 65001 >nul

if "%DB_USER%"=="" set DB_USER=norms2
if "%DB_NAME%"=="" set DB_NAME=norms2

where docker >nul 2>&1
if errorlevel 1 (
  echo Ошибка: docker не найден в PATH.
  exit /b 1
)

rem ── выбор контейнера ────────────────────────────────────────────────────────
set CONTAINER=
set HAS_DEV=
set HAS_PROD=
for /f "delims=" %%n in ('docker ps --format "{{.Names}}"') do (
  if "%%n"=="norms2_postgres_dev" set HAS_DEV=1
  if "%%n"=="norms2_postgres_prod" set HAS_PROD=1
)

if defined HAS_DEV if defined HAS_PROD (
  echo Найдено несколько окружений:
  echo   1^) norms2_postgres_dev
  echo   2^) norms2_postgres_prod
  set /p CHOICE=Куда выдаём права? [1-2]:
  if "!CHOICE!"=="1" set CONTAINER=norms2_postgres_dev
  if "!CHOICE!"=="2" set CONTAINER=norms2_postgres_prod
) else (
  if defined HAS_DEV set CONTAINER=norms2_postgres_dev
  if defined HAS_PROD set CONTAINER=norms2_postgres_prod
)

if "%CONTAINER%"=="" (
  echo Ошибка: не найден работающий контейнер БД ^(norms2_postgres_dev или norms2_postgres_prod^).
  echo Поднимите окружение: make dev-up ^(локально^) или make prod-up ^(на сервере^).
  exit /b 1
)
echo Окружение: %CONTAINER%

rem ── аккаунт должен уже существовать ─────────────────────────────────────────
echo.
echo Роль выдаётся СУЩЕСТВУЮЩЕМУ аккаунту: сначала зарегистрируйтесь в «Нормисах»,
echo и только потом запускайте этот скрипт.
set /p REGISTERED=Аккаунт уже зарегистрирован? [y/N]:
if /i not "%REGISTERED%"=="y" if /i not "%REGISTERED%"=="yes" if /i not "%REGISTERED%"=="д" if /i not "%REGISTERED%"=="да" (
  echo Тогда сначала регистрация — и запустите скрипт снова.
  exit /b 0
)

set LOGIN=%~1
if "%LOGIN%"=="" set /p LOGIN=Логин аккаунта:
if "%LOGIN%"=="" (
  echo Ошибка: логин пустой.
  exit /b 1
)

rem ── SQL ─────────────────────────────────────────────────────────────────────
rem Текст запроса общий с grant-admin.sh — лежит рядом в grant-admin.sql, чтобы две копии
rem однажды не разъехались.
set SQL_FILE=%~dp0grant-admin.sql
if not exist "%SQL_FILE%" (
  echo Ошибка: не найден %SQL_FILE%
  exit /b 1
)

type "%SQL_FILE%" | docker exec -i %CONTAINER% psql -U %DB_USER% -d %DB_NAME% -v login=%LOGIN% -q

echo.
echo Текущие роли:
docker exec -i %CONTAINER% psql -U %DB_USER% -d %DB_NAME% -t -A -c "select a.login || ' -> ' || coalesce(string_agg(r.code, ' + ' order by r.code), '(ролей нет)') from accounts a left join account_roles ar on ar.account_id = a.id left join roles r on r.id = ar.role_id where lower(a.login) = lower('%LOGIN%') group by a.login;"

echo.
echo Готово. Права действуют сразу — перезапуск не нужен.
endlocal

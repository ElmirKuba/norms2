-- Выдать роль администратора существующему аккаунту «Нормисов».
--
-- Общий текст для scripts/grant-admin.sh и scripts/grant-admin.cmd: один SQL на обе системы,
-- иначе две копии однажды разъедутся. Ожидает переменную psql `login`:
--     psql -v login=<логин> -f scripts/grant-admin.sql
--
-- Логин попадает внутрь блока через настройку сессии, а НЕ как :'login': psql подставляет свои
-- переменные только ВНЕ долларовых кавычек, и внутри `do $$ … $$` `:'login'` осталось бы
-- буквальным текстом (проверено — синтаксическая ошибка).
--
-- Идентификаторы собираются здесь же в формате uuidv7___unixmillis (ADR-0016): скрипт не должен
-- знать про генератор приложения. Сравнение логина — без учёта регистра, как в самом продукте.
\set ON_ERROR_STOP on
select set_config('norms2.grant_login', :'login', false) \g /dev/null

do $$
declare
  v_login      text := current_setting('norms2.grant_login');
  v_account_id varchar(52);
  v_role_id    varchar(52);
begin
  select id into v_account_id from accounts where lower(login) = lower(v_login);
  if v_account_id is null then
    raise exception 'Аккаунта с логином "%" не существует. Сначала регистрация.', v_login;
  end if;

  select id into v_role_id from roles where lower(code) = 'admin';
  if v_role_id is null then
    raise exception 'В справочнике нет роли admin. Поднимите бэкенд хотя бы раз — он засеет роли.';
  end if;

  if exists (select 1 from account_roles where account_id = v_account_id and role_id = v_role_id) then
    raise notice 'У "%" уже есть роль admin — ничего не меняем.', v_login;
    return;
  end if;

  insert into account_roles (id, account_id, role_id)
  values (gen_random_uuid()::text || '___' || (extract(epoch from now()) * 1000)::bigint::text,
          v_account_id, v_role_id);

  -- Выдача прав — событие журнала (2.9.3·6). Актёр пуст: действовал не пользователь продукта,
  -- а тот, у кого есть доступ к серверу; источник записан в details.
  insert into admin_audit_log (id, actor_account_id, actor_login, action, target_type, target_id, target_label, details)
  values (gen_random_uuid()::text || '___' || (extract(epoch from now()) * 1000 + 1)::bigint::text,
          null, null, 'role.granted', 'account', v_account_id, v_login,
          jsonb_build_object('role', 'admin', 'source', 'grant-admin'));

  raise notice 'Роль admin выдана: %', v_login;
end $$;

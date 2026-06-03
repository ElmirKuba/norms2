import type { AccountBase } from './account-base.interface';

/**
 * AccountCreate — данные для создания аккаунта (= Base, ADR-0033): id, версию и
 * системные метки добавляет нижний слой (репозиторий/БД). Тип-алиас, не дубль.
 */
export type AccountCreate = AccountBase;

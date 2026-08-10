import { SETTING_TELEGRAM_BOT_PAUSED } from '../settings/domain-services/settings.domain-service';

/**
 * Белый список настроек, которые админка вправе менять (2.9.3·5).
 *
 * **Почему список, а не «любой ключ».** Открытый key/value по HTTP превращается в свалку:
 * заводятся ключи, которых никто не читает, а опечатка в имени создаёт новую настройку вместо
 * ошибки. Здесь незнакомый ключ — 404, то есть настройки не существует.
 *
 * Тип нужен, чтобы отбить `{"value": "да"}` на входе: значение хранится строкой, но это не
 * повод принимать любую строку.
 */
export const EDITABLE_SETTINGS: ReadonlyMap<string, 'boolean'> = new Map([
  [SETTING_TELEGRAM_BOT_PAUSED, 'boolean'],
]);

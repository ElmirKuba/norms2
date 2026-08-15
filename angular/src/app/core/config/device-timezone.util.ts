/**
 * Часовой пояс устройства в формате IANA (`Asia/Yekaterinburg`).
 *
 * Берём у браузера, а не спрашиваем человека: он и так знает, где находится, а список из
 *
 * четырёхсот зон в форме регистрации — верный способ выбрать «UTC» и забыть.
 * @returns Зона устройства или `undefined`, если браузер её не сообщил.
 */
export function deviceTimezone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone === '' ? undefined : zone;
  } catch {
    return undefined;
  }
}

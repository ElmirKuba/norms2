/**
 * Генерирует uuid v7 (128 бит): 48 бит времени (мс) + версия 7 + вариант RFC 4122
 * + случайные биты. Возрастающий по времени → сортируемый.
 * @returns Строка uuid v7 в каноническом виде с дефисами.
 */
function uuidV7(): string {
  const timestamp = BigInt(Date.now());
  const bytes = new Uint8Array(16);
  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);
  globalThis.crypto.getRandomValues(bytes.subarray(6));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // версия 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // вариант RFC 4122
  const hex = Array.from(bytes, (byte: number): string =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Сквозной идентификатор формата `uuidv7___unixmillis` (ADR-0016). Тот же формат
 * на бэке (свой параллельный файл — типы/утилиты фронта и бэка НЕ шарятся).
 * @returns Идентификатор вида `<uuidv7>___<unixMillis>`.
 */
export function generateId(): string {
  return `${uuidV7()}___${Date.now().toString()}`;
}

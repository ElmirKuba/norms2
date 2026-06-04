/** Множители единиц длительности в миллисекундах. */
const UNIT_MS: Readonly<Record<string, number>> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Парсит длительность вида `30d` / `12h` / `15m` / `45s` в миллисекунды
 * (для TTL из конфига — ACCESS_TTL/REFRESH_TTL).
 * @param value Строка длительности.
 * @returns Длительность в миллисекундах.
 * @throws {Error} Если формат не распознан.
 */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (match === null) {
    throw new Error(`Некорректная длительность: ${value}`);
  }
  const amount = Number(match[1] ?? '0');
  const unit = match[2] ?? 's';
  return amount * (UNIT_MS[unit] ?? 1000);
}

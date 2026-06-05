/** Допустимые расширения аватарки. */
export type ImageExt = 'jpg' | 'png' | 'webp';

/**
 * Определяет тип изображения по сигнатуре (magic bytes) — НЕ по mimetype/имени
 * (их легко подделать). Поддержка: JPEG, PNG, WEBP.
 * @param data Байты файла.
 * @returns Расширение или null, если не распознано.
 */
export function detectImageExt(data: Buffer): ImageExt | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'jpg';
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    return 'png';
  }
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

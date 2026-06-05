/** DI-токен порта хранилища аватарок (биндится в profile.module). */
export const AVATAR_STORAGE = Symbol('AVATAR_STORAGE');

/**
 * Порт хранилища аватарок — абстракция над файловой системой (ADR-0031: диск
 * сейчас, S3 потом за тем же портом). Домен/use-case не трогают `fs` напрямую.
 * Пути — относительные к корню `content/` (как хранится в `accounts.avatar`).
 */
export interface AvatarStoragePort {
  /**
   * Сохраняет файл аватарки под новым именем (`generateId().<ext>`).
   * @param data Байты изображения.
   * @param ext Расширение (jpg/png/webp).
   * @returns Относительный путь (напр. `avatars/<id>.jpg`).
   */
  save(data: Buffer, ext: string): Promise<string>;

  /**
   * Удаляет файл по относительному пути (best-effort: отсутствие — не ошибка).
   * @param relativePath Относительный путь из `accounts.avatar`.
   * @returns Промис завершения.
   */
  delete(relativePath: string): Promise<void>;
}

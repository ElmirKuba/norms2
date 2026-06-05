import type { BanFull } from './ban-full.interface';

/**
 * BanView — проекция бана наружу (листинг «мои баны», ответ на создание). Без
 * `bannerId` (всегда = текущий пользователь) и `updatedAt` (внутреннее).
 */
export type BanView = Pick<BanFull, 'id' | 'targetId' | 'reason' | 'active' | 'createdAt'>;

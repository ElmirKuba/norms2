import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../system/config/env.schema';

/** Папка с авторскими seed-файлами в образе/репо (рядом с рантаймом, cwd-relative). */
const SEED_DIR = 'seed-content';

/**
 * Содержимое релиз-нот на диске (2.9.3·13).
 *
 * **Выделено из сида, потому что писателей стало двое.** Ноту создаёт и сид при старте, и админ
 * из панели; правило «файл должен лежать в раздаваемой папке, иначе публикация откроется пустой»
 * одно на обоих. Две копии этого правила разошлись бы ровно в тот момент, когда одна из них
 * перестала бы копировать.
 *
 * **Файл не загружается через API намеренно.** Тексты нот живут в репозитории и приезжают
 * образом: заливка контента по HTTP превратила бы админку в CMS и оторвала историю выпусков от
 * git. Панель может лишь **зарегистрировать публикацию** для файла, который уже развёрнут.
 */
@Injectable()
export class ReleaseContentService {
  private readonly _logger = new Logger(ReleaseContentService.name);
  private readonly _contentDir: string;
  private readonly _seedDir: string;

  /**
   * @param configService Конфиг (`CONTENT_DIR` — раздаваемая папка).
   */
  public constructor(configService: ConfigService<Env, true>) {
    this._contentDir = resolve(configService.get('CONTENT_DIR', { infer: true }));
    this._seedDir = resolve(process.cwd(), SEED_DIR);
  }

  /**
   * Убеждается, что файл ноты лежит в раздаваемой папке; при отсутствии копирует из `seed-content`.
   * @param contentFile Путь относительно папки контента.
   * @returns `true`, если файл на месте (или скопирован); `false` — его нет нигде.
   */
  public ensureAvailable(contentFile: string): boolean {
    const destination = join(this._contentDir, contentFile);
    if (existsSync(destination)) {
      return true;
    }
    const source = join(this._seedDir, contentFile);
    if (!existsSync(source)) {
      return false;
    }
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    this._logger.log(`Релиз-нота скопирована в content/: ${contentFile}`);
    return true;
  }
}

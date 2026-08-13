import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/guards/roles.decorator';
import { ReadAuditLogUseCase } from '../use-cases/read-audit-log.use-case';
import type { AuditEntryView } from '../interfaces/audit-entry-view.interface';

/**
 * Журнал действий администратора (`/api/v1/admin/audit-log`, 2.9.3·14).
 *
 * **Только чтение — и это свойство архитектуры, а не забывчивость.** Ни `PATCH`, ни `DELETE`
 * здесь появиться не могут: в порте репозитория (·6) их попросту нет. Чтобы подчистить след,
 * придётся идти в базу руками — то есть совершить заметное осознанное действие.
 */
@Controller('admin/audit-log')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminAuditController {
  /**
   * @param _readAuditLogUseCase Чтение журнала.
   */
  public constructor(private readonly _readAuditLogUseCase: ReadAuditLogUseCase) {}

  /**
   * Последние записи журнала, новые сверху.
   * @param limit Сколько записей вернуть (по умолчанию 100, потолок 500).
   * @param action Код действия для фильтра; незнакомый — пустая лента, а не ошибка.
   * @returns Строки журнала.
   */
  @Get()
  public async list(
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ): Promise<AuditEntryView[]> {
    const filter = (action ?? '').trim();
    return this._readAuditLogUseCase.execute(Number(limit), filter === '' ? null : filter);
  }
}

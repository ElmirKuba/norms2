import { Module } from '@nestjs/common';
import { AccessControlModule } from '../auth/access-control.module';
import { InvitesModule } from '../invites/invites.module';
import { RecoveryModule } from '../recovery/recovery.module';
import { DashboardModule } from '../accent/dashboard/dashboard.module';
import { StatsController } from './controllers/stats.controller';
import { GetOverviewStatsUseCase } from './use-cases/get-overview-stats.use-case';

/**
 * Модуль статистики (overview, F4): один контроллер + агрегирующий use-case.
 * Кросс-домен ВНИЗ (только чтение): `AccessControlModule` (Guard + реэкспорт
 * account/bans/sessions доменов), `InvitesModule` (invites + дерево), `RecoveryModule`
 * (секретные вопросы), `DashboardModule` «Акцента» (срез раздела для обзора, 2.9·16 — наружу
 * он отдаёт только `AccentSnapshotDomainService`). Лист графа — никто его не импортирует,
 * цикла нет: разделы про ЛК-статистику не знают.
 */
@Module({
  imports: [AccessControlModule, InvitesModule, RecoveryModule, DashboardModule],
  controllers: [StatsController],
  providers: [GetOverviewStatsUseCase],
})
export class StatsModule {}

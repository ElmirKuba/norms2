import { Module } from '@nestjs/common';
import { AntiHabitsModule } from '../accent/anti-habits/anti-habits.module';
import { ObstaclesModule } from '../accent/obstacles/obstacles.module';
import { MicroWinsModule } from '../accent/micro-wins/micro-wins.module';
import { HabitsModule } from '../accent/habits/habits.module';
import { DATA_FIX_STATE } from './adapters/data-fix-state.port';
import { DataFixStateRepository } from '../../database/repositories/maintenance/data-fix-state.repository';
import { DataFixRunner } from './domain-services/data-fix.runner';
import { PurgeHiddenContentFix } from './fixes/purge-hidden-content.fix';

/**
 * Разовые починки данных (2.9.3·25) — composition root.
 *
 * Импортирует **модули областей** (не зонтик `AccentModule`: он их не реэкспортирует) ради их
 * доменных сервисов: починки обязаны ходить через них,
 * а не через репозитории и тем более не через SQL. Кросс-домен идёт **вниз** (раннер — этаж
 * use-case), поэтому цикла не возникает.
 */
@Module({
  imports: [AntiHabitsModule, ObstaclesModule, MicroWinsModule, HabitsModule],
  providers: [
    { provide: DATA_FIX_STATE, useClass: DataFixStateRepository },
    PurgeHiddenContentFix,
    DataFixRunner,
  ],
})
export class MaintenanceModule {}

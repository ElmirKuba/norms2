import { Module } from '@nestjs/common';
import { AccessControlModule } from '../../auth/access-control.module';
import { MicroWinsModule } from '../micro-wins/micro-wins.module';
import { ACCENT_OBSTACLE_REPOSITORY } from './adapters/accent-obstacle-repository.port';
import { AccentObstacleRepository } from '../../../database/repositories/accent/accent-obstacle.repository';
import { ACCENT_COUNTERPLAY_REPOSITORY } from './adapters/accent-counterplay-repository.port';
import { ACCENT_OBSTACLE_ENCOUNTER_REPOSITORY } from './adapters/accent-obstacle-encounter-repository.port';
import { AccentObstacleEncounterRepository } from '../../../database/repositories/accent/accent-obstacle-encounter.repository';
import { AccentCounterplayRepository } from '../../../database/repositories/accent/accent-counterplay.repository';
import { AccentObstacleDomainService } from './domain-services/accent-obstacle.domain-service';
import { AccentCounterplayDomainService } from './domain-services/accent-counterplay.domain-service';
import { AccentObstacleEncounterDomainService } from './domain-services/accent-obstacle-encounter.domain-service';
import { ObstaclesController } from './controllers/obstacles.controller';
import { ListObstaclesUseCase } from './use-cases/list-obstacles.use-case';
import { GetObstacleUseCase } from './use-cases/get-obstacle.use-case';
import { CreateObstacleUseCase } from './use-cases/create-obstacle.use-case';
import { UpdateObstacleUseCase } from './use-cases/update-obstacle.use-case';
import { DeleteObstacleUseCase } from './use-cases/delete-obstacle.use-case';
import { ReorderObstaclesUseCase } from './use-cases/reorder-obstacles.use-case';
import { ListCounterplaysUseCase } from './use-cases/list-counterplays.use-case';
import { CreateCounterplayUseCase } from './use-cases/create-counterplay.use-case';
import { UpdateCounterplayUseCase } from './use-cases/update-counterplay.use-case';
import { DeleteCounterplayUseCase } from './use-cases/delete-counterplay.use-case';
import { ReorderCounterplaysUseCase } from './use-cases/reorder-counterplays.use-case';
import { RecordEncounterUseCase } from './use-cases/record-encounter.use-case';
import { ListEncountersUseCase } from './use-cases/list-encounters.use-case';
import { SetEncounterOutcomeUseCase } from './use-cases/set-encounter-outcome.use-case';
import { SeedObstacleStarterPackUseCase } from './use-cases/seed-obstacle-starter-pack.use-case';
import { ClearObstacleStartersUseCase } from './use-cases/clear-obstacle-starters.use-case';
import { AdoptObstacleUseCase } from './use-cases/adopt-obstacle.use-case';
import { SetObstacleArchivedUseCase } from './use-cases/set-obstacle-archived.use-case';

/**
 * Область препятствий раздела «Акцент» (мультимодуль, ADR-0050; подфаза 2.7, ADR-0062).
 * Composition root: биндит порт `ACCENT_OBSTACLE_REPOSITORY` → Drizzle-репо, поднимает
 * `AccentObstacleDomainService`, контроллер `/accent/obstacles` под AuthGuard (импорт
 * `AccessControlModule`) и тонкие use-cases.
 *
 * **Экспортирует domain-service** — он понадобится соседям сверху вниз: use-case «Держусь»
 * при рецидиве проверит выбранное препятствие (ADR-0062 п.9), а позже `Recommender` (2.8) и
 * дашборд (2.11) прочитают список. Обратной зависимости нет: препятствия ни о ком не знают.
 *
 * Импортит `MicroWinsModule` — контрмера может ссылаться на микро-победу, и эту привязку
 * проверяет `AccentCounterplayDomainService` через её domain-service (кросс-домен строго вниз;
 * обратной зависимости нет, поэтому круга не возникает). Журнал столкновений (блок D) даёт обе
 * вычисляемые на чтение величины раздела: «мешал N раз за 30 дней» и «помогало N из M».
 * События геймификации в 2.7 не эмитим (ADR-0062 п.13) — порта событий здесь намеренно нет.
 */
@Module({
  imports: [AccessControlModule, MicroWinsModule],
  controllers: [ObstaclesController],
  providers: [
    { provide: ACCENT_OBSTACLE_REPOSITORY, useClass: AccentObstacleRepository },
    { provide: ACCENT_COUNTERPLAY_REPOSITORY, useClass: AccentCounterplayRepository },
    {
      provide: ACCENT_OBSTACLE_ENCOUNTER_REPOSITORY,
      useClass: AccentObstacleEncounterRepository,
    },
    AccentObstacleDomainService,
    AccentCounterplayDomainService,
    AccentObstacleEncounterDomainService,
    ListObstaclesUseCase,
    SetObstacleArchivedUseCase,
    GetObstacleUseCase,
    CreateObstacleUseCase,
    UpdateObstacleUseCase,
    DeleteObstacleUseCase,
    ReorderObstaclesUseCase,
    ListCounterplaysUseCase,
    CreateCounterplayUseCase,
    UpdateCounterplayUseCase,
    DeleteCounterplayUseCase,
    ReorderCounterplaysUseCase,
    RecordEncounterUseCase,
    ListEncountersUseCase,
    SetEncounterOutcomeUseCase,
    SeedObstacleStarterPackUseCase,
    ClearObstacleStartersUseCase,
    AdoptObstacleUseCase,
  ],
  exports: [
    AccentObstacleDomainService,
    AccentCounterplayDomainService,
    AccentObstacleEncounterDomainService,
  ],
})
export class ObstaclesModule {}

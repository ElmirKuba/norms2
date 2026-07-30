import { Module } from '@nestjs/common';
import { AccessControlModule } from '../../auth/access-control.module';
import { ACCENT_OBSTACLE_REPOSITORY } from './adapters/accent-obstacle-repository.port';
import { AccentObstacleRepository } from '../../../database/repositories/accent/accent-obstacle.repository';
import { AccentObstacleDomainService } from './domain-services/accent-obstacle.domain-service';
import { ObstaclesController } from './controllers/obstacles.controller';
import { ListObstaclesUseCase } from './use-cases/list-obstacles.use-case';
import { GetObstacleUseCase } from './use-cases/get-obstacle.use-case';
import { CreateObstacleUseCase } from './use-cases/create-obstacle.use-case';
import { UpdateObstacleUseCase } from './use-cases/update-obstacle.use-case';
import { DeleteObstacleUseCase } from './use-cases/delete-obstacle.use-case';
import { ReorderObstaclesUseCase } from './use-cases/reorder-obstacles.use-case';

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
 * Контрмеры (блок C) и журнал столкновений (блок D) добавят сюда свои порты и use-cases.
 * События геймификации в 2.7 не эмитим (ADR-0062 п.13) — порта событий здесь намеренно нет.
 */
@Module({
  imports: [AccessControlModule],
  controllers: [ObstaclesController],
  providers: [
    { provide: ACCENT_OBSTACLE_REPOSITORY, useClass: AccentObstacleRepository },
    AccentObstacleDomainService,
    ListObstaclesUseCase,
    GetObstacleUseCase,
    CreateObstacleUseCase,
    UpdateObstacleUseCase,
    DeleteObstacleUseCase,
    ReorderObstaclesUseCase,
  ],
  exports: [AccentObstacleDomainService],
})
export class ObstaclesModule {}

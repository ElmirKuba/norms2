import { Module } from '@nestjs/common';
import { AccessControlModule } from '../../auth/access-control.module';
import { ACCENT_MICRO_WIN_REPOSITORY } from './adapters/accent-micro-win-repository.port';
import { AccentMicroWinRepository } from '../../../database/repositories/accent/accent-micro-win.repository';
import { AccentMicroWinDomainService } from './domain-services/accent-micro-win.domain-service';
import { MicroWinsController } from './controllers/micro-wins.controller';
import { ListMicroWinsUseCase } from './use-cases/list-micro-wins.use-case';
import { CreateMicroWinUseCase } from './use-cases/create-micro-win.use-case';
import { UpdateMicroWinUseCase } from './use-cases/update-micro-win.use-case';
import { DeleteMicroWinUseCase } from './use-cases/delete-micro-win.use-case';

/**
 * Область микро-побед раздела «Акцент» (мультимодуль, ADR-0050): порт
 * `ACCENT_MICRO_WIN_REPOSITORY` → Drizzle-репо, `AccentMicroWinDomainService`
 * (per-account CRUD с инвариантами и владением), контроллер `/accent/micro-wins`
 * под AuthGuard (импорт `AccessControlModule`) + тонкие use-cases. `complete` (лог) —
 * подфаза 2.2·4. Экспортит domain-service для кросс-домена вниз (Recommender 2.7).
 */
@Module({
  imports: [AccessControlModule],
  controllers: [MicroWinsController],
  providers: [
    { provide: ACCENT_MICRO_WIN_REPOSITORY, useClass: AccentMicroWinRepository },
    AccentMicroWinDomainService,
    ListMicroWinsUseCase,
    CreateMicroWinUseCase,
    UpdateMicroWinUseCase,
    DeleteMicroWinUseCase,
  ],
  exports: [AccentMicroWinDomainService],
})
export class MicroWinsModule {}

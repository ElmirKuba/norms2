import { Global, Module } from '@nestjs/common';
import { HashService } from './services/hash.service';

/**
 * Глобальный модуль кросс-доменных сервисов (без ORM). Сейчас — HashService;
 * сюда же добавятся прочие общие провайдеры по мере надобности.
 */
@Global()
@Module({
  providers: [HashService],
  exports: [HashService],
})
export class SharedModule {}

import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { RateLimit } from '../../../shared/guards/rate-limit.decorator';
import { startRecoverySchema } from '../dtos/start-recovery.dto';
import type { StartRecoveryDto } from '../dtos/start-recovery.dto';
import { completeRecoverySchema } from '../dtos/complete-recovery.dto';
import type { CompleteRecoveryDto } from '../dtos/complete-recovery.dto';
import { StartRecoveryUseCase } from '../use-cases/start-recovery.use-case';
import { CompleteRecoveryUseCase } from '../use-cases/complete-recovery.use-case';
import type { RecoveryQuestion } from '../interfaces/recovery-question.interface';

/** Ответ старта восстановления: K вопросов-челленджей. */
interface StartRecoveryResponse {
  /** Вопросы (id+текст), на которые нужно ответить. */
  questions: RecoveryQuestion[];
}

/**
 * Контроллер флоу восстановления (`/api/v1/recovery/start|complete`) — ПУБЛИЧНЫЙ
 * (пользователь забыл пароль, не залогинен). Анти-энумерация — rate-limit на F5.
 */
@Controller('recovery')
export class RecoveryController {
  /**
   * @param _startRecoveryUseCase Старт (выдача K вопросов).
   * @param _completeRecoveryUseCase Завершение (сверка + сброс пароля).
   */
  public constructor(
    private readonly _startRecoveryUseCase: StartRecoveryUseCase,
    private readonly _completeRecoveryUseCase: CompleteRecoveryUseCase,
  ) {}

  /**
   * Стартует восстановление: по логину отдаёт K случайных вопросов.
   * @param body Тело (логин).
   * @returns { questions }.
   */
  @Post('start')
  @HttpCode(200)
  @RateLimit(5, 600_000)
  public async start(
    @Body(new ZodValidationPipe(startRecoverySchema)) body: StartRecoveryDto,
  ): Promise<StartRecoveryResponse> {
    const questions = await this._startRecoveryUseCase.execute(body.login);
    return { questions };
  }

  /**
   * Завершает восстановление: сверяет ответы и ставит новый пароль.
   * @param body Тело (логин, ответы, новый пароль).
   * @returns Промис завершения (204).
   */
  @Post('complete')
  @HttpCode(204)
  @RateLimit(10, 600_000)
  public async complete(
    @Body(new ZodValidationPipe(completeRecoverySchema)) body: CompleteRecoveryDto,
  ): Promise<void> {
    await this._completeRecoveryUseCase.execute(body.login, body.answers, body.newPassword);
  }
}

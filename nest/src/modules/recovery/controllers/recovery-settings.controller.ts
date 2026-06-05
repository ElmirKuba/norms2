import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { addSecretQuestionSchema } from '../dtos/add-secret-question.dto';
import type { AddSecretQuestionDto } from '../dtos/add-secret-question.dto';
import { setRequiredCountSchema } from '../dtos/set-required-count.dto';
import type { SetRequiredCountDto } from '../dtos/set-required-count.dto';
import { AddSecretQuestionUseCase } from '../use-cases/add-secret-question.use-case';
import { RemoveSecretQuestionUseCase } from '../use-cases/remove-secret-question.use-case';
import { ListMySecretQuestionsUseCase } from '../use-cases/list-my-secret-questions.use-case';
import { SetRecoveryRequiredCountUseCase } from '../use-cases/set-recovery-required-count.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import type { SecretQaView } from '../interfaces/secret-qa-view.interface';

/**
 * Контроллер настроек восстановления (`/api/v1/recovery/*`) — всё под Guard
 * (настраивает свой аккаунт). Управление секретными вопросами и K (ADR-0008).
 */
@Controller('recovery')
export class RecoverySettingsController {
  /**
   * @param _addSecretQuestionUseCase Добавление вопроса.
   * @param _removeSecretQuestionUseCase Удаление вопроса.
   * @param _listMySecretQuestionsUseCase Список вопросов.
   * @param _setRecoveryRequiredCountUseCase Установка K.
   */
  public constructor(
    private readonly _addSecretQuestionUseCase: AddSecretQuestionUseCase,
    private readonly _removeSecretQuestionUseCase: RemoveSecretQuestionUseCase,
    private readonly _listMySecretQuestionsUseCase: ListMySecretQuestionsUseCase,
    private readonly _setRecoveryRequiredCountUseCase: SetRecoveryRequiredCountUseCase,
  ) {}

  /**
   * Список «мои секретные вопросы».
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекции вопросов.
   */
  @Get('questions')
  @UseGuards(AuthGuard)
  public async listMine(@Req() request: AuthenticatedRequest): Promise<SecretQaView[]> {
    return this._listMySecretQuestionsUseCase.execute(request.account.id);
  }

  /**
   * Добавляет секретный вопрос.
   * @param body Тело (вопрос + ответ).
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция созданного вопроса.
   */
  @Post('questions')
  @UseGuards(AuthGuard)
  public async add(
    @Body(new ZodValidationPipe(addSecretQuestionSchema)) body: AddSecretQuestionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SecretQaView> {
    return this._addSecretQuestionUseCase.execute(request.account.id, body.question, body.answer);
  }

  /**
   * Удаляет свой вопрос.
   * @param id Идентификатор вопроса.
   * @param request Запрос (аккаунт из Guard).
   * @returns Промис завершения.
   */
  @Delete('questions/:id')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  public async remove(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._removeSecretQuestionUseCase.execute(id, request.account.id);
  }

  /**
   * Устанавливает K (сколько вопросов спрашивать при восстановлении).
   * @param body Тело (requiredCount).
   * @param request Запрос (аккаунт из Guard).
   * @returns Промис завершения.
   */
  @Put('required-count')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  public async setRequiredCount(
    @Body(new ZodValidationPipe(setRequiredCountSchema)) body: SetRequiredCountDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._setRecoveryRequiredCountUseCase.execute(request.account.id, body.requiredCount);
  }
}

import { Module } from '@nestjs/common';
import { AccessControlModule } from '../../auth/access-control.module';
import { ACCENT_TODO_REPOSITORY } from './adapters/accent-todo-repository.port';
import { AccentTodoRepository } from '../../../database/repositories/accent/accent-todo.repository';
import { AccentTodoDomainService } from './domain-services/accent-todo.domain-service';
import { TodosController } from './controllers/todos.controller';
import { ListTodosUseCase } from './use-cases/list-todos.use-case';
import { CreateTodoUseCase } from './use-cases/create-todo.use-case';
import { UpdateTodoUseCase } from './use-cases/update-todo.use-case';
import { SetTodoDoneUseCase } from './use-cases/set-todo-done.use-case';
import { SetTodoArchivedUseCase } from './use-cases/set-todo-archived.use-case';
import { DeleteTodoUseCase } from './use-cases/delete-todo.use-case';
import { ReorderTodosUseCase } from './use-cases/reorder-todos.use-case';

/**
 * Область списков дел раздела «Акцент» (2.10, блок C): порт `ACCENT_TODO_REPOSITORY` →
 * Drizzle-репозиторий, доменные правила, контроллер `/accent/todos` под AuthGuard (импорт
 * `AccessControlModule`) + тонкие use-cases.
 *
 * Domain-service экспортируется заранее: превращения (2.14) и таймлайн (2.19) будут ходить сюда
 * кросс-доменом вниз, как остальные области раздела.
 */
@Module({
  imports: [AccessControlModule],
  controllers: [TodosController],
  providers: [
    { provide: ACCENT_TODO_REPOSITORY, useClass: AccentTodoRepository },
    AccentTodoDomainService,
    ListTodosUseCase,
    CreateTodoUseCase,
    UpdateTodoUseCase,
    SetTodoDoneUseCase,
    SetTodoArchivedUseCase,
    DeleteTodoUseCase,
    ReorderTodosUseCase,
  ],
  exports: [AccentTodoDomainService],
})
export class TodosModule {}

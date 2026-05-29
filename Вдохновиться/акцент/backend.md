# Backend (NestJS)

Корень — `./nest/`. Стек объявлен в [`../Technical-assignment.md#стек`](../Technical-assignment.md#3-стек).

## Структура

```
nest/
├── src/
│   ├── main.ts                       # bootstrap
│   ├── app.module.ts                 # сборка корня
│   ├── config/                       # ConfigModule, env-схема
│   ├── common/
│   │   ├── decorators/               # @CurrentUser и т.п.
│   │   ├── filters/                  # http exception filter
│   │   ├── guards/                   # JwtAuthGuard
│   │   ├── interceptors/             # logging, transform
│   │   ├── pipes/                    # ValidationPipe конфиг
│   │   └── utils/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   ├── dto/
│   │   │   └── auth.spec.ts
│   │   ├── users/
│   │   ├── goals/
│   │   ├── tasks/
│   │   │   ├── tasks.module.ts
│   │   │   ├── tasks.controller.ts
│   │   │   ├── tasks.service.ts
│   │   │   ├── task-templates.controller.ts
│   │   │   ├── task-templates.service.ts
│   │   │   ├── recurrence.service.ts
│   │   │   ├── rollover.processor.ts  # BullMQ worker
│   │   │   ├── entities/
│   │   │   ├── dto/
│   │   │   └── *.spec.ts
│   │   ├── anti-habits/
│   │   ├── weekly/
│   │   ├── metrics/
│   │   ├── lessons/
│   │   ├── workouts/
│   │   ├── scheduled/
│   │   ├── gamification/
│   │   ├── dashboard/
│   │   └── realtime/
│   ├── migrations/
│   └── database/
│       ├── data-source.ts
│       └── seed.ts
├── test/                             # e2e тесты
├── package.json
├── tsconfig.json
├── .env.example
└── Dockerfile
```

## Конвенции

### Модуль

Каждый модуль самодостаточен. Зависимости — через `imports` и `exports`. Никаких прямых импортов из чужой `entities/` папки.

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Goal, GoalEntry])],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
```

### Контроллер

Только маршрутизация, валидация, трансформация. Никакой бизнес-логики.

```ts
@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: ListGoalsDto) {
    return this.goalsService.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(user.id, dto);
  }
}
```

### Сервис

Бизнес-логика, проверка инвариантов, эмит событий.

```ts
@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(Goal) private readonly goals: Repository<Goal>,
    @InjectRepository(GoalEntry) private readonly entries: Repository<GoalEntry>,
    private readonly events: EventEmitter2,
  ) {}

  async addEntry(userId: string, goalId: string, dto: AddEntryDto) {
    const goal = await this.goals.findOneOrFail({ where: { id: goalId, userId } });
    const entry = this.entries.create({ goalId, ...dto });
    await this.entries.save(entry);

    const total = await this.computeCurrentValue(goalId);
    if (total >= goal.targetValue && goal.status === 'active') {
      goal.status = 'completed';
      goal.completedAt = new Date();
      await this.goals.save(goal);
      this.events.emit('goal.completed', { userId, goalId });
    }
    this.events.emit('goal_entry.created', { userId, goalId, entryId: entry.id, value: dto.value });
    return entry;
  }
}
```

### DTO

```ts
export class CreateGoalDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsIn(['spiritual', 'physical', 'mental'])
  category!: 'spiritual' | 'physical' | 'mental';

  @IsNumber()
  @IsPositive()
  targetValue!: number;

  @IsString()
  @Length(1, 32)
  unit!: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

Все эндпоинты валидируют DTO через глобальный `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.

### Entity

```ts
@Entity('goals')
export class Goal {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index()
  @Column('uuid') userId!: string;

  @Column({ length: 200 }) title!: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column() category!: 'spiritual' | 'physical' | 'mental';
  @Column('numeric', { precision: 12, scale: 3 }) targetValue!: number;
  @Column({ length: 32 }) unit!: string;
  @Column({ type: 'date', nullable: true }) deadline?: string;
  @Column({ default: 'active' }) status!: 'active' | 'completed' | 'archived';
  @Column({ type: 'timestamptz', nullable: true }) completedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
```

### Скоупинг по пользователю

В каждом сервисе первый аргумент — `userId`. Все запросы фильтруются по `userId`. Для предотвращения утечек — линтер-проверка или базовый `BaseScopedService` на финале фазы 2.

## Конфигурация

`@nestjs/config` с валидацией через `joi`:

```ts
// src/config/env.schema.ts
export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),
  CORS_ORIGINS: Joi.string().required(),
});
```

Перечень переменных — [`./deployment.md#переменные-окружения`](./deployment.md#переменные-окружения).

## Ролловер дня

Расписанная задача BullMQ:

```
queue: 'rollover'
schedule: '*/5 * * * *'   // каждые 5 минут
processor: RolloverProcessor
```

Процессор:
1. Берёт пользователей, у которых `last_rollover_date < user_local_today`.
2. Для каждого открывает транзакцию.
3. Идёт по активным `TaskTemplate`, через `RecurrenceService.matchesDate(rrule, localDate)` решает, создать ли `Task`.
4. Записывает `last_rollover_date = localToday`.
5. Эмитит событие `dashboard.invalidate` для всех активных WS-сессий пользователя.

`RecurrenceService` использует библиотеку `rrule` (npm). Тесты обязательны для DST и пограничных дней.

## События

`@nestjs/event-emitter`. Все события документируются в [`./gamification.md#доменные-события`](./gamification.md#доменные-события).

```ts
@OnEvent('task.completed')
async onTaskCompleted(payload: TaskCompletedEvent) { ... }
```

## Логирование

`pino-http` с `nestjs-pino`. JSON-формат. Уровень из `LOG_LEVEL`.

Никогда не логируем: пароли, токены, refresh-токены, тело запросов на `/api/auth/*`.

## Тестирование

- **Unit (Jest):** все сервисы. Моки репозиториев через `jest.fn()`.
- **Integration (Jest + Supertest):** контроллеры + реальная тестовая БД (в Docker, отдельная схема).
- **E2E:** в фазе 9 через Playwright (с уровня фронта, проходит весь стек).

Покрытие сервисов ≥ 70% — обязательное условие закрытия фазы.

## Безопасность

- Пароли — bcrypt, cost 12.
- Refresh-токены — opaque, длина 256 бит, хранятся как bcrypt-хеш.
- Rate limit: `@nestjs/throttler`, 100 req/min на IP, отдельные лимиты для `/api/auth/login` (10/min/IP).
- Helmet middleware включён.
- CORS только из `CORS_ORIGINS`.

## Запуск (dev)

```bash
cd nest
cp .env.example .env
# отредактировать .env
npm install
npm run migration:run
npm run start:dev
```

Полная инструкция — [`./getting-started.md`](./getting-started.md).

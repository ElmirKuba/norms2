# Makefile «Нормисов» — обёртки над docker compose и dev-команды.
# Главная цель: PROJECT_ROOT вычисляется автоматически (корень репо) и
# экспортируется в окружение, поэтому пути в compose — абсолютные
# (${PROJECT_ROOT}/docker/...), а не хрупкие ./../../ .

# Подхватываем .env (если есть) и экспортируем все переменные в окружение,
# которое наследует docker compose. .env без inline-комментариев (см. .env.example).
ifneq (,$(wildcard .env))
include .env
export
endif

# Корень репозитория. := фиксирует значение один раз. export — отдать в env.
export PROJECT_ROOT := $(shell pwd)

DEV_COMPOSE  := docker compose --env-file .env -f docker/compose-files/docker-compose.dev.yml
PROD_COMPOSE := docker compose --env-file .env -f docker/compose-files/docker-compose.prod.yml

.PHONY: help dev-up dev-up-detach dev-down dev-logs dev-ps dev-restart db-psql dev-config db-generate db-migrate db-studio prod-build prod-up prod-down prod-config

help: ## Показать список команд
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

dev-up: ## Поднять dev в форграунде (логи в терминал, Ctrl+C — стоп)
	$(DEV_COMPOSE) up

dev-up-detach: ## Поднять dev в фоне (-d)
	$(DEV_COMPOSE) up -d

dev-down: ## Остановить dev
	$(DEV_COMPOSE) down

dev-logs: ## Логи dev (follow)
	$(DEV_COMPOSE) logs -f

dev-ps: ## Статус контейнеров dev
	$(DEV_COMPOSE) ps

dev-restart: dev-down dev-up-detach ## Перезапустить dev (в фоне)

dev-config: ## Проверить dev-compose (render с подстановкой)
	$(DEV_COMPOSE) config

db-psql: ## psql в dev-постгрес
	$(DEV_COMPOSE) exec postgres psql -U $(DB_USER) -d $(DB_NAME)

db-generate: ## drizzle-kit: сгенерить миграцию из orm-схем
	cd nest && npm run db:generate

db-migrate: ## drizzle-kit: накатить миграции на БД
	cd nest && npm run db:migrate

db-studio: ## drizzle-kit: GUI по БД
	cd nest && npm run db:studio

prod-build: ## Собрать prod-образы
	$(PROD_COMPOSE) build

prod-up: ## Поднять prod
	$(PROD_COMPOSE) up -d

prod-down: ## Остановить prod
	$(PROD_COMPOSE) down

prod-config: ## Проверить prod-compose
	$(PROD_COMPOSE) config

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

.PHONY: help dev-up dev-down dev-logs dev-ps dev-restart db-psql dev-config prod-build prod-up prod-down prod-config

help: ## Показать список команд
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

dev-up: ## Поднять dev (postgres + pgAdmin)
	$(DEV_COMPOSE) up -d

dev-down: ## Остановить dev
	$(DEV_COMPOSE) down

dev-logs: ## Логи dev (follow)
	$(DEV_COMPOSE) logs -f

dev-ps: ## Статус контейнеров dev
	$(DEV_COMPOSE) ps

dev-restart: dev-down dev-up ## Перезапустить dev

dev-config: ## Проверить dev-compose (render с подстановкой)
	$(DEV_COMPOSE) config

db-psql: ## psql в dev-постгрес
	$(DEV_COMPOSE) exec postgres psql -U $(DB_USER) -d $(DB_NAME)

prod-build: ## Собрать prod-образы
	$(PROD_COMPOSE) build

prod-up: ## Поднять prod
	$(PROD_COMPOSE) up -d

prod-down: ## Остановить prod
	$(PROD_COMPOSE) down

prod-config: ## Проверить prod-compose
	$(PROD_COMPOSE) config

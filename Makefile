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

.PHONY: help dev-up dev-up-detach dev-rebuild dev-down dev-logs dev-ps dev-restart db-psql dev-config db-generate db-migrate db-studio prod-build prod-up prod-down prod-config env-cleanup

help: ## Показать список команд
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

dev-up: ## Поднять dev в форграунде (логи в терминал, Ctrl+C — стоп)
	$(DEV_COMPOSE) up

dev-up-detach: ## Поднять dev в фоне (-d)
	$(DEV_COMPOSE) up -d

dev-rebuild: ## Пересобрать образы и поднять (после смены зависимостей/Dockerfile)
	$(DEV_COMPOSE) up --build

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

env-cleanup: ## ОПАСНО: снести контейнеры/локальные образы/ДАННЫЕ только этого проекта (5×y чтобы удалить)
	@printf "⚠️  Удалит контейнеры, локально собранные образы (nest/angular) и ВСЕ данные проекта\n   (docker/volumes/pg_data, pgadmin_data). Базовые образы (postgres/node/pgadmin) и чужие ресурсы НЕ трогаются. Необратимо.\n"
	@for i in 1 2 3 4 5; do \
		read -p "Подтверждение $$i/5 — введите 'y' (любой другой ответ отменит): " ans; \
		if [ "$$ans" != "y" ]; then echo "Отменено — ничего не удалено."; exit 0; fi; \
	done; \
	echo "Удаляю окружение проекта…"; \
	$(DEV_COMPOSE) down --rmi local --volumes --remove-orphans; \
	$(PROD_COMPOSE) down --rmi local --volumes --remove-orphans 2>/dev/null || true; \
	rm -rf docker/volumes/pg_data docker/volumes/pgadmin_data; \
	echo "✅ Очищено. Новый старт: make dev-rebuild  (затем при необходимости make db-migrate)."

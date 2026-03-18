COMPOSE  := docker compose -f infra/docker-compose.yml
API_DIR  := apps/api

.DEFAULT_GOAL := help

.PHONY: help env dev infra-up infra-down up up-build down reset logs logs-api \
        install build test lint migrate migrate-revert

# ─── Help ──────────────────────────────────────────────────────────────────

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*## .*$$' $(MAKEFILE_LIST) | sort | \
	  awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── First-time setup ──────────────────────────────────────────────────────

env: ## Copy env templates if they don't exist yet
	@[ -f apps/api/.env ] || (cp apps/api/.env.example apps/api/.env && echo "Created apps/api/.env")
	@[ -f infra/.env ]    || (cp infra/.env.example infra/.env       && echo "Created infra/.env")

# ─── Local development (API on host) ───────────────────────────────────────

dev: infra-up ## Start infra then run the API with hot-reload
	cd $(API_DIR) && npm run start:dev

infra-up: ## Start Postgres and Redis only (detached)
	$(COMPOSE) up postgres redis -d

infra-down: ## Stop all containers (volumes kept)
	$(COMPOSE) down

# ─── Full Docker stack ─────────────────────────────────────────────────────

up: ## Start all services, skip rebuild if image is up to date
	$(COMPOSE) up -d

up-build: ## Build and start all services (force-recreate to pick up new image)
	$(COMPOSE) up --build --force-recreate -d

down: ## Stop all services (volumes kept)
	$(COMPOSE) down

reset: ## Stop all services and delete persistent volumes
	$(COMPOSE) down -v

logs: ## Follow logs from all containers
	$(COMPOSE) logs -f

logs-api: ## Follow API container logs only
	$(COMPOSE) logs -f api

# ─── Application ───────────────────────────────────────────────────────────

install: ## Install npm dependencies
	cd $(API_DIR) && npm ci

build: ## Compile TypeScript via nest build
	cd $(API_DIR) && npm run build

test: ## Run unit tests
	cd $(API_DIR) && npm test -- --passWithNoTests

lint: ## Run ESLint (errors fail, warnings pass)
	cd $(API_DIR) && npx eslint "src/**/*.ts"

# ─── Database ──────────────────────────────────────────────────────────────

migrate: ## Run pending TypeORM migrations
	cd $(API_DIR) && npm run migration:run

migrate-revert: ## Revert the most recent migration
	cd $(API_DIR) && npm run migration:revert

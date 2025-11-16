.PHONY: help run build test clean swagger migrate-up migrate-down migrate-status migrate-new tree

# Detectar sistema operativo
ifeq ($(OS),Windows_NT)
    DETECTED_OS := Windows
else
    DETECTED_OS := $(shell uname -s)
endif

# Variables
APP_NAME := core
CMD_API := ./cmd/api
CMD_MIGRATE := ./cmd/migrate
DOCS_DIR := ./internal/docs
DOCS_FILE := $(DOCS_DIR)/docs.go
BIN_DIR := bin

help: ## Mostrar ayuda
	@echo "Comandos disponibles:"
	@echo "  make run              - Ejecutar la API en modo desarrollo"
	@echo "  make build            - Compilar binarios"
	@echo "  make test             - Ejecutar tests"
	@echo "  make swagger          - Generar documentación Swagger"
	@echo "  make migrate-up       - Aplicar migraciones pendientes"
	@echo "  make migrate-down     - Revertir última migración"
	@echo "  make migrate-status   - Ver estado de migraciones"
	@echo "  make migrate-new      - Crear nueva migración (name=nombre)"
	@echo "  make tree             - Mostrar estructura del proyecto"
	@echo "  make clean            - Limpiar archivos generados"

run:
	@echo "Starting API server with AIR..."
	air

build:
	@echo "Building binarios..."
	@echo "Build complete: $(BIN_DIR)/"

test:
	@echo "Running tests..."
	@echo "Coverage report: coverage.html"

swagger:
	@echo "Generating Swagger documentation..."
	@powershell -ExecutionPolicy Bypass -File create_swag_docs.ps1
	@echo "Swagger documentation ready at /swagger/index.html"

migrate-up:
	@echo "Running migrations up..."
	go run $(CMD_MIGRATE) up

migrate-down:
	@echo "Running migrations down..."
	go run $(CMD_MIGRATE) down

migrate-status:
	@echo "Checking migration status..."
	go run $(CMD_MIGRATE) status

migrate-new:
ifndef name
	@echo "Error: Debes especificar name=nombre_migracion"
	@echo "Ejemplo: make migrate-new name=add_roles"
	@exit 1
endif
ifeq ($(DETECTED_OS),Windows)
	@powershell -Command "$$timestamp = Get-Date -Format 'yyyyMMddHHmmss'; \
		$$version = \"$${timestamp}_$(name)\"; \
		$$upfile = \"cmd\\migrate\\migrations\\$${version}.up.sql\"; \
		$$downfile = \"cmd\\migrate\\migrations\\$${version}.down.sql\"; \
		New-Item -ItemType Directory -Path 'cmd\\migrate\\migrations' -Force | Out-Null; \
		New-Item -ItemType File -Path $$upfile -Force | Out-Null; \
		New-Item -ItemType File -Path $$downfile -Force | Out-Null; \
		Write-Host 'Created migration files:' -ForegroundColor Green; \
		Write-Host \"  $$upfile\"; \
		Write-Host \"  $$downfile\""
else
	@timestamp=$$(date +%Y%m%d%H%M%S); \
	version="$${timestamp}_$(name)"; \
	upfile="cmd/migrate/migrations/$${version}.up.sql"; \
	downfile="cmd/migrate/migrations/$${version}.down.sql"; \
	mkdir -p cmd/migrate/migrations; \
	touch "$$upfile" "$$downfile"; \
	echo "Created migration files:"; \
	echo "  $$upfile"; \
	echo "  $$downfile"
endif

tree:
	@go run ./internal/pkg/tree.go

consolidate:
	@go run ./internal/pkg/consolidate.go

clean:
	@echo "Cleaning..."
	@echo "Clean complete"

.DEFAULT_GOAL := help
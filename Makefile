.PHONY: help install test test-coverage build build-dev serve check clean

help: ## Mostrar ayuda
	@echo "Comandos disponibles:"
	@echo "  make install          - Instalar dependencias (npm ci)"
	@echo "  make test             - Ejecutar unit tests (ChromeHeadless)"
	@echo "  make test-coverage    - Ejecutar tests con reporte de cobertura"
	@echo "  make build            - Build de producción en dist/"
	@echo "  make build-dev        - Build de desarrollo"
	@echo "  make serve            - Servidor de desarrollo (puerto 4200)"
	@echo "  make check            - install + test + build (pre-push)"
	@echo "  make clean            - Limpiar dist/ y node_modules/"

install:
	@echo "Installing dependencies..."
	npm ci
	@echo "Dependencies installed."

test:
	@echo "Running unit tests..."
	npx ng test --watch=false --no-progress --browsers=ChromeHeadless

test-coverage:
	@echo "Running tests with coverage..."
	npx ng test --watch=false --no-progress --browsers=ChromeHeadless --code-coverage
	@echo "Coverage report: coverage/index.html"

build:
	@echo "Building production..."
	npx ng build --configuration=production
	@echo "Build complete: dist/"

build-dev:
	@echo "Building development..."
	npx ng build --configuration=development

serve:
	@echo "Starting dev server on http://localhost:4200 ..."
	npx ng serve

deploy-test:
	@echo "Deploying to test..."
	cd manifests && helm upgrade --install --namespace test-yvaga -f .\values-test.yaml test-yvaga-frontend . --create-namespace --force-replace

deploy:
	@echo "Deploying to prod..."
	cd manifests && helm upgrade --install --namespace yvaga -f .\values.yaml yvaga-frontend . --create-namespace --force-replace

check: install test build
	@echo "All checks passed. Listo para subir."

clean:
	@echo "Cleaning..."
	@rm -rf dist coverage
	@echo "Clean complete."

.DEFAULT_GOAL := help

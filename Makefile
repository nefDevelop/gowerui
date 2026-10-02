# Makefile for gowerGUI (Wails v2 + SvelteKit project)

# Define variables
WAILS := wails
NPM := npm
GO := go
WAILS_TAGS := -tags webkit2_41

# main.go embebe frontend/build con //go:embed, así que `go build`, `go vet` y
# `go test` fallan si el frontend no está compilado:
#   pattern all:frontend/build: no matching files found
# Por eso todo target que toque Go depende de FRONTEND_STAMP.
FRONTEND_BUILD := frontend/build/index.html
FRONTEND_STAMP := frontend/.build-stamp
NODE_MODULES := frontend/node_modules

.PHONY: all build dev clean install-deps \
        frontend-build frontend-install-deps \
        test test-unit test-integration test-e2e \
        lint typecheck check

# Default target
all: build

## FRONTEND DEPENDENCIES ##

# Alias histórico.
install-deps: frontend-install-deps

# Se instala solo cuando cambian los manifiestos o falta node_modules.
frontend-install-deps: $(NODE_MODULES)

$(NODE_MODULES): frontend/package.json frontend/package-lock.json
	@echo "Installing Node.js dependencies..."
	cd frontend && $(NPM) install
	@touch $@

## FRONTEND BUILD ##

frontend-build: $(FRONTEND_STAMP)

$(FRONTEND_STAMP): $(NODE_MODULES) $(shell find frontend/src -type f 2>/dev/null)
	@echo "Building frontend..."
	cd frontend && $(NPM) run build
	@touch $@

# objetivo materializado para que make sepa "construir" el asset embebido
$(FRONTEND_BUILD): $(FRONTEND_STAMP)
	@:

## APP BUILD ##

build: frontend-build
	@echo "Building Wails application..."
	$(WAILS) build $(WAILS_TAGS)

dev: frontend-install-deps
	$(WAILS) dev $(WAILS_TAGS)

clean:
	@echo "Cleaning build artifacts..."
	rm -rf ./build
	rm -rf ./frontend/build
	rm -f $(FRONTEND_STAMP) gowerui
	@echo "Build artifacts cleaned."

## TESTS ##

# Orquestador: ejecuta toda la suite. Los E2E quedan fuera porque no hay specs
# de Playwright escritos todavía y no deben romper el pipeline.
test: test-unit test-integration

# Tests unitarios: backend Go + capa API y stores del frontend
test-unit: $(FRONTEND_STAMP)
	@echo "==> Go unit tests"
	$(GO) test ./... -count=1
	@echo "==> Frontend unit tests"
	cd frontend && $(NPM) run test:unit

# Tests de integración: verifica que el backend compila y enlaza correctamente
# los assets embebidos del frontend.
test-integration: $(FRONTEND_STAMP)
	@echo "==> go vet"
	$(GO) vet ./...
	@echo "==> go build (enlaza //go:embed de frontend/build)"
	$(GO) build -o /dev/null .

# Tests E2E (Playwright). Desactivado hasta escribir los specs.
test-e2e:
	cd frontend && $(NPM) run test:e2e

## CALIDAD ##

# go vet compila el paquete main, que incluye el //go:embed del frontend.
lint: $(FRONTEND_STAMP)
	@echo "==> gofmt"
	@unformatted=$$(gofmt -l . | grep -v '^frontend/' || true); \
	if [ -n "$$unformatted" ]; then \
		echo "Ficheros sin gofmt:"; echo "$$unformatted"; exit 1; \
	fi
	@echo "==> go vet"
	$(GO) vet ./...

typecheck: frontend-install-deps
	@echo "==> svelte-check"
	cd frontend && $(NPM) run check

check: lint typecheck test

# Docker Builds (Need to be updated for Wails if used)
docker-linux:
	@echo "Docker build for Wails not yet implemented in this Makefile"

docker-windows:
	@echo "Building for Windows using Wails..."
	$(WAILS) build -platform windows/amd64

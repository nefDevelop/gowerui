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

# Pin del sidecar gower: el tag vive en .gower-version y es la única fuente de
# verdad de la versión que se empaqueta.
GOWER_VERSION_FILE := .gower-version
GOWER_REPO := nefDevelop/gower
GOWER_ASSET := gower

.PHONY: all build dev clean install install-deps \
        frontend-build frontend-install-deps \
        sidecar-info verify-sidecar doctor \
        test test-unit test-integration test-contract test-e2e \
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

# La versión es la de wails.json, inyectada con -ldflags en main.version. Es la
# única fuente de verdad: package.json y wails.json deben coincidir.
APP_VERSION := $(shell node -p "require('./wails.json').info.productVersion" 2>/dev/null || echo dev)
LDFLAGS := -X main.version=$(APP_VERSION)

build: frontend-build
	@echo "Building Wails application (version $(APP_VERSION))..."
	$(WAILS) build $(WAILS_TAGS) -ldflags "$(LDFLAGS)"

dev: frontend-install-deps
	$(WAILS) dev $(WAILS_TAGS)

## INSTALACIÓN LOCAL (Linux) ##

# Instala para el usuario actual, sin sudo. `PREFIX` sigue la convención XDG:
# el lanzador y el icono van bajo $PREFIX/share y los binarios en $PREFIX/bin.
PREFIX ?= $(HOME)/.local
BINDIR ?= $(PREFIX)/bin
APPDIR ?= $(PREFIX)/share/applications
ICONDIR ?= $(PREFIX)/share/icons/hicolor/128x128/apps
APP_ID := gowerui

# El sidecar se descarga del pin, como en las releases portables: nunca de
# releases/latest, para que local y CI instalen la misma versión.
SIDECAR_DIR := sidecar
SIDECAR_BIN := $(SIDECAR_DIR)/$(GOWER_ASSET)

# La pareja gowerui+gower queda como ficheros hermanos en $(BINDIR), que es el
# layout que resuelve lookupGowerPath (sidecar junto al ejecutable). Si cambias
# esto, cambia también el orden de búsqueda de app.go.
install: build $(SIDECAR_BIN)
	@echo "Instalando $(APP_ID) $(APP_VERSION) en $(BINDIR)..."
	mkdir -p $(BINDIR) $(APPDIR) $(ICONDIR)
	install -m 0755 build/bin/$(APP_ID) $(BINDIR)/$(APP_ID)
	install -m 0755 $(SIDECAR_BIN) $(BINDIR)/$(GOWER_ASSET)
	install -m 0644 frontend/static/favicon.png $(ICONDIR)/$(APP_ID).png
	@# Ruta absoluta en Exec e Icon: el lanzador del menú no hereda cwd y el
	@# nombre de icono lo resuelve el tema hicolor.
	@{ \
		echo '[Desktop Entry]'; \
		echo 'Type=Application'; \
		echo 'Name=Gower UI'; \
		echo 'Comment=GUI for Gower Wallpaper Engine'; \
		echo 'Exec=$(BINDIR)/$(APP_ID)'; \
		echo 'Icon=$(APP_ID)'; \
		echo 'Terminal=false'; \
		echo 'Categories=Utility;Graphics;'; \
	} > $(APPDIR)/$(APP_ID).desktop
	chmod 0644 $(APPDIR)/$(APP_ID).desktop
	@echo "Listo. Ejecuta '$(APP_ID)' o búscalo en el menú de aplicaciones."

# Fichero materializado para que make no revalide el checksum en cada `make
# install`; al cambiar el pin o el script, se vuelve a descargar.
$(SIDECAR_BIN): $(GOWER_VERSION_FILE) scripts/fetch-sidecar.sh
	bash scripts/fetch-sidecar.sh $(SIDECAR_DIR)

clean:
	@echo "Cleaning build artifacts..."
	rm -rf ./build
	rm -rf ./frontend/build
	rm -f $(FRONTEND_STAMP) gowerui
	@echo "Build artifacts cleaned."

## DIAGNÓSTICO ##

# Smoke test con el layout real de la release: el sidecar se copia junto al
# binario (como en el tar portable) y se ejecuta el autodiagnóstico, que no
# inicializa GTK.
doctor: build $(SIDECAR_BIN)
	install -m 0755 $(SIDECAR_BIN) build/bin/$(GOWER_ASSET)
	./build/bin/gowerui --doctor

## SIDECAR ##

# Regenera frontend/src/lib/sidecar-info.json a partir de .gower-version.
# Úsalo al bumpear el pin para que el fichero commiteado no se quede atrás.
sidecar-info:
	bash scripts/render-sidecar-info.sh

# Comprueba que el pin apunta a una release real con el asset esperado.
# Necesita red, por eso NO forma parte de `make check`.
verify-sidecar:
	@tag=$$(tr -d '[:space:]' < $(GOWER_VERSION_FILE)); \
	if [ -z "$$tag" ]; then echo "ERROR: $(GOWER_VERSION_FILE) vacío"; exit 1; fi; \
	url="https://github.com/$(GOWER_REPO)/releases/download/$$tag/$(GOWER_ASSET)"; \
	echo "Verificando $(GOWER_REPO)@$$tag..."; \
	if curl -fsSL -r 0-0 -o /dev/null "$$url"; then \
		echo "OK: $$url"; \
	else \
		echo "ERROR: no existe el asset en $$url"; exit 1; \
	fi

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

# Verificación del contrato con el sidecar real. Necesita GOWER_BIN (y opcional
# GOWER_CONTRACT); por eso NO forma parte de `make test`, que debe correr sin
# el binario. En CI lo cablea el job `test` descargando el pin.
test-contract: $(FRONTEND_STAMP)
	@echo "==> Go contract tests"
	$(GO) test ./... -run 'TestGowerContract' -count=1 -v

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

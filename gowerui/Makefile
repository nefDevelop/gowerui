# Makefile for gowerGUI (Tauri + SvelteKit project)

# Define variables
NPM := npm
TAURI := $(NPM) run tauri
# Default target is "all". Override with `make build TARGET="deb"` or `make build TARGET="msi"`
TARGET ?= all

.PHONY: all build run dev clean install

# Default target
all: build

# Install frontend dependencies
install:
	@echo "Installing Node.js dependencies..."
	$(NPM) install

# Build the SvelteKit frontend and then the Tauri application
build: install
	@echo "Building SvelteKit frontend..."
	$(NPM) run build
	@echo "Building Tauri application..."
	$(TAURI) build --target $(TARGET)

# Run the application in development mode
run: install
	$(TAURI) dev

# Clean generated build files
clean:
	@echo "Cleaning build artifacts..."
	rm -rf ./build
	rm -rf ./src-tauri/target
	@echo "Build artifacts cleaned."

# Docker Builds
docker-linux:
	docker build -t gowerui-linux -f Dockerfile.linux .
	docker run --rm -v $(PWD)/src-tauri/target:/app/src-tauri/target gowerui-linux

docker-windows:
	docker build -t gowerui-windows -f Dockerfile.windows .
	docker run --rm -v $(PWD)/src-tauri/target:/app/src-tauri/target gowerui-windows
# Makefile for gowerGUI (Wails v2 + SvelteKit project)

# Define variables
WAILS := wails
NPM := npm
WAILS_TAGS := -tags webkit2_41

.PHONY: all build dev clean install-deps

# Default target
all: build

# Install frontend dependencies
install-deps:
	@echo "Installing Node.js dependencies..."
	cd frontend && $(NPM) install

# Build the Wails application
build: install-deps
	@echo "Building Wails application..."
	$(WAILS) build $(WAILS_TAGS)

# Run the application in development mode
dev: install-deps
	$(WAILS) dev $(WAILS_TAGS)

# Clean generated build files
clean:
	@echo "Cleaning build artifacts..."
	rm -rf ./build
	rm -rf ./frontend/build
	rm -f gowerui
	@echo "Build artifacts cleaned."

# Docker Builds (Need to be updated for Wails if used)
docker-linux:
	@echo "Docker build for Wails not yet implemented in this Makefile"

docker-windows:
	@echo "Building for Windows using Wails..."
	$(WAILS) build -platform windows/amd64

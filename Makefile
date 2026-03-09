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
	@echo "--- Starting Windows Build in Docker ---"
	docker build -t gowerui-windows -f Dockerfile.windows .
	docker run --rm -v $(PWD)/src-tauri/target:/app/src-tauri/target gowerui-windows
	@echo "--- Organizing Release Files ---"
	@mkdir -p dist-releases/windows
	@# Copy the Installer
	@cp src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/*.exe dist-releases/windows/ 2>/dev/null || echo "No installer found"
	@# Run the portable script to gather all files
	@chmod +x dist-windows-portable.sh
	@./dist-windows-portable.sh
	@mv dist-windows-portable dist-releases/windows/portable
	@echo "--------------------------------------------------"
	@echo "DONE! Your Windows files are ready in: dist-releases/windows/"
	@ls -R dist-releases/windows/
	@echo "--------------------------------------------------"
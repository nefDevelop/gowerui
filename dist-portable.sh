#!/bin/bash
set -e

echo "Building Gower GUI (Portable)..."

# Ensure the build is up to date
npm run tauri build || echo "Tauri build finished (ignoring bundler errors if binary exists)"

# Target directory
DIST_DIR="dist-portable"
mkdir -p "$DIST_DIR"

# Paths
BINARY_SRC="src-tauri/target/release/gowerui"
SIDECAR_SRC="src-tauri/binaries/gower-x86_64-unknown-linux-gnu"

# Check if binary exists
if [ ! -f "$BINARY_SRC" ]; then
    echo "Error: Binary not found at $BINARY_SRC. Build failed?"
    exit 1
fi

# Copy files
echo "Copying binaries to $DIST_DIR..."
cp "$BINARY_SRC" "$DIST_DIR/"
# Put it directly in the root of the portable dir and call it 'gower'
cp "$SIDECAR_SRC" "$DIST_DIR/gower"

# Make sure they are executable
chmod +x "$DIST_DIR/gowerui"
chmod +x "$DIST_DIR/gower"

echo "--------------------------------------------------"
echo "Portable version created in: $DIST_DIR/"
echo "To run it: cd $DIST_DIR && ./gowerui"
echo "--------------------------------------------------"

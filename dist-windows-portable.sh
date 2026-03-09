#!/bin/bash
set -e

# Target directory
DIST_DIR="dist-windows-portable"
mkdir -p "$DIST_DIR"

echo "Creating Windows Portable Distribution..."

# Paths
BINARY_SRC="src-tauri/target/x86_64-pc-windows-gnu/release/gowerui.exe"
DLL_SRC="src-tauri/target/x86_64-pc-windows-gnu/release/WebView2Loader.dll"
# Sidecar original source
SIDECAR_SRC="src-tauri/binaries/gower-x86_64-pc-windows-gnu.exe"

# Check if binaries exist
if [ ! -f "$BINARY_SRC" ]; then
    echo "Error: Main binary not found at $BINARY_SRC. Please run 'make docker-windows' first."
    exit 1
fi

if [ ! -f "$SIDECAR_SRC" ]; then
    echo "Error: Sidecar binary not found at $SIDECAR_SRC."
    exit 1
fi

# Copy main files
echo "Copying main files to $DIST_DIR..."
cp "$BINARY_SRC" "$DIST_DIR/"
cp "$DLL_SRC" "$DIST_DIR/"

# Tauri sidecar structure in portable mode:
# Usually it's in the same folder as the .exe but with the full name
echo "Copying sidecar with its full target name (required by Tauri)..."
cp "$SIDECAR_SRC" "$DIST_DIR/gower-x86_64-pc-windows-gnu.exe"

echo "--------------------------------------------------"
echo "Windows Portable version created in: $DIST_DIR/"
echo "Files included:"
ls -F "$DIST_DIR"
echo "--------------------------------------------------"
echo "Note: To make it work, KEEP all these files in the same folder."
echo "--------------------------------------------------"

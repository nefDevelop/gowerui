#!/bin/bash
set -e

GOWER_REPO="nefDevelop/gower"
GOWER_BINARIES_DIR="src-tauri/binaries"
GOWER_INFO_FILE="src/lib/sidecar-info.json"

# Ensure binaries directory exists
mkdir -p "$GOWER_BINARIES_DIR"

# Get latest release tag
LATEST_RELEASE_TAG=$(curl -s "https://api.github.com/repos/$GOWER_REPO/releases/latest" | grep -Po '"tag_name": "\K.*?(?=")')

if [ -z "$LATEST_RELEASE_TAG" ]; then
    echo "Error: Could not fetch latest release tag for $GOWER_REPO. Check internet connection or repository name."
    exit 1
fi

echo "Latest gower release: $LATEST_RELEASE_TAG"

# Determine platform and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

GOWER_FILENAME="gower"
TAURI_TARGET_TRIPLE=""
DOWNLOAD_FILENAME=""

case "$OS" in
    linux)
        case "$ARCH" in
            x86_64)
                TAURI_TARGET_TRIPLE="x86_64-unknown-linux-gnu"
                DOWNLOAD_FILENAME="gower-linux-amd64"
                ;;
            aarch64)
                TAURI_TARGET_TRIPLE="aarch64-unknown-linux-gnu"
                DOWNLOAD_FILENAME="gower-linux-arm64"
                ;;
            *)
                echo "Unsupported Linux architecture: $ARCH"
                exit 1
                ;;
        esac
        ;;
    # Add cases for darwin and windows if needed for local development on those platforms
    *)
        echo "Unsupported OS for automatic download: $OS. Please download gower binary manually."
        exit 1
        ;;
esac

TARGET_PATH="$GOWER_BINARIES_DIR/$GOWER_FILENAME-$TAURI_TARGET_TRIPLE"
DOWNLOAD_URL="https://github.com/$GOWER_REPO/releases/download/$LATEST_RELEASE_TAG/$DOWNLOAD_FILENAME"

echo "Downloading $DOWNLOAD_URL to $TARGET_PATH"
curl -L "$DOWNLOAD_URL" -o "$TARGET_PATH"
chmod +x "$TARGET_PATH"

echo "Successfully downloaded gower binary."

# Update src/lib/sidecar-info.json
if command -v jq &> /dev/null
then
    echo "Updating $GOWER_INFO_FILE with version $LATEST_RELEASE_TAG"
    jq --arg version "$LATEST_RELEASE_TAG" '.version = $version' "$GOWER_INFO_FILE" > "$GOWER_INFO_FILE.tmp" && mv "$GOWER_INFO_FILE.tmp" "$GOWER_INFO_FILE"
else
    echo "Warning: jq not found. Could not update $GOWER_INFO_FILE with the latest version."
fi
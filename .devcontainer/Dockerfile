# Devcontainer para gowerGUI (Wails v2 + SvelteKit + Go)
# Sustituye al anterior basado en Rust/Tauri tras la migración a Wails.

FROM node:20-bullseye AS node_stage

FROM mcr.microsoft.com/devcontainers/go:1-bullseye

# Node.js desde la stage de node (misma glibc para que el binario sea compatible)
COPY --from=node_stage /usr/local/bin/node /usr/local/bin/
COPY --from=node_stage /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
COPY --from=node_stage /opt/ /opt/
ENV PATH="/opt/yarn-v1.22.19/bin:${PATH}"

USER root

# Dependencias de sistema para Wails v2 (GTK + WebKitGTK 4.1) y build de Go
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
        build-essential \
        pkg-config \
        libwebkit2gtk-4.1-dev \
        libgtk-3-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev \
        curl \
        wget \
        file \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Wails CLI en el PATH del usuario no-root (/go/bin ya está en el PATH)
RUN go install github.com/wailsapp/wails/v2/cmd/wails@v2.12.0

USER vscode
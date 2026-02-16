# Use a multi-stage build to get Node.js
FROM node:18-bullseye as node_stage

# The final stage of our container
FROM mcr.microsoft.com/devcontainers/rust:1-bullseye

# Copy Node.js from the node_stage
COPY --from=node_stage /usr/local/bin/node /usr/local/bin/
COPY --from=node_stage /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
COPY --from=node_stage /opt/ /opt/

# Switch to root to install dependencies
USER root

# Install Tauri system dependencies for Ubuntu/Debian
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    appmenu-gtk2-module \
    appmenu-gtk3-module \
    libsoup2.4-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* 

# Revert to the default non-root user
USER vscode

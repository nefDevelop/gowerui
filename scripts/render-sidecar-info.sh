#!/usr/bin/env bash
# Genera frontend/src/lib/sidecar-info.json a partir del pin .gower-version.
#
# El tag del sidecar vive únicamente en .gower-version: este script es la forma
# de materializarlo en el JSON que se empaqueta, para que local y CI produzcan
# exactamente el mismo fichero.
#
# Uso: scripts/render-sidecar-info.sh [binary]
#   binary  nombre del asset descargado (por defecto "gower"; en Windows
#           el workflow pasa "gower.exe").
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version_file="$root/.gower-version"
out_file="$root/frontend/src/lib/sidecar-info.json"

if [[ ! -f "$version_file" ]]; then
	echo "ERROR: no existe $version_file" >&2
	exit 1
fi

tag="$(tr -d '[:space:]' < "$version_file")"
if [[ -z "$tag" ]]; then
	echo "ERROR: $version_file está vacío" >&2
	exit 1
fi

binary="${1:-gower}"
repo="nefDevelop/gower"

printf '{\n  "version": "%s",\n  "repo": "%s",\n  "binary": "%s"\n}\n' \
	"$tag" "$repo" "$binary" > "$out_file"

echo "sidecar-info.json -> gower@$tag ($binary)"

#!/usr/bin/env bash
# Descarga y verifica el sidecar gower del tag fijado en .gower-version.
#
# El pin (y no releases/latest) es lo que hace reproducible la instalación: el
# gower que se instala en local es exactamente el que viaja en las releases
# portables. La integridad se comprueba contra el checksums.txt de la release.
#
# Uso: scripts/fetch-sidecar.sh [dest_dir]
#   dest_dir  directorio donde dejar el binario y su checksums.txt
#             (por defecto <repo>/sidecar, que está en .gitignore).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version_file="$root/.gower-version"
dest="${1:-$root/sidecar}"

if [[ ! -f "$version_file" ]]; then
	echo "ERROR: no existe $version_file" >&2
	exit 1
fi

tag="$(tr -d '[:space:]' < "$version_file")"
if [[ -z "$tag" ]]; then
	echo "ERROR: $version_file está vacío" >&2
	exit 1
fi

repo="nefDevelop/gower"
asset="gower"
base_url="https://github.com/$repo/releases/download/$tag"

mkdir -p "$dest"

# Se descarga a un directorio temporal y se mueve al final: un corte de red no
# debe dejar un binario parcial que make considere ya descargado.
tmp="$(mktemp -d "$dest/.fetch.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

echo "Descargando $repo@$tag ($asset)..."
# -f convierte un tag o asset inexistente en error, en vez de guardar el HTML
# de la página 404 como si fuera el binario.
curl -fSL --retry 3 --retry-all-errors "$base_url/$asset" -o "$tmp/$asset"
curl -fSL --retry 3 --retry-all-errors "$base_url/checksums.txt" -o "$tmp/checksums.txt"

# gower publica el checksum con la ruta del asset dentro del archivo
# ("linux/gower"), no como "/gower": se acepta tanto la ruta con prefijo como
# el nombre suelto para no romper si cambia el formato.
expected="$(awk -v a="$asset" '$2 == a || $2 ~ ("(^|/)" a "$") {print $1}' "$tmp/checksums.txt")"
if command -v sha256sum >/dev/null 2>&1; then
	actual="$(sha256sum "$tmp/$asset" | awk '{print $1}')"
else
	actual="$(shasum -a 256 "$tmp/$asset" | awk '{print $1}')"
fi

# Sin checksum publicado no se instala nada: mejor un error ruidoso que un
# sidecar sin verificar.
if [[ -z "$expected" || "$expected" != "$actual" ]]; then
	echo "ERROR: checksum no coincide para $asset (esperado '$expected', real '$actual')" >&2
	exit 1
fi

chmod +x "$tmp/$asset"
mv -f "$tmp/$asset" "$dest/$asset"
mv -f "$tmp/checksums.txt" "$dest/checksums.txt"

echo "sidecar listo: $dest/$asset (gower@$tag, checksum OK)"

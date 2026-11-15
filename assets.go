package main

import (
	"os"
	"path/filepath"
	"strings"
)

// servableAssetExtensions es la lista blanca de /local-asset. El handler sirve
// ficheros del disco a la webview; sin acotar, un fallo en el frontend o un
// `path` inesperado de gower convertiría la app en un lector de ficheros
// arbitrario (/etc/passwd, claves SSH, configuración). Solo pasan los formatos
// que la interfaz pinta como miniatura o fondo.
var servableAssetExtensions = map[string]bool{
	// Imágenes
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".webp": true,
	".avif": true,
	".gif":  true,
	".bmp":  true,
	".svg":  true,
	".tif":  true,
	".tiff": true,
	// Vídeo (algunos backends de wallpaper lo aceptan)
	".mp4":  true,
	".webm": true,
	".mkv":  true,
	".mov":  true,
}

// canServeLocalAsset decide si una ruta puede servirse por /local-asset: debe
// existir, ser un fichero regular y tener una extensión de la lista blanca. Los
// directorios se rechazan para no exponer listados ni seguir enlaces raros.
func canServeLocalAsset(path string) bool {
	info, err := os.Stat(path)
	if err != nil || !info.Mode().IsRegular() {
		return false
	}

	return servableAssetExtensions[strings.ToLower(filepath.Ext(path))]
}

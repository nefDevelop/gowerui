package main

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
)

const (
	logFileName = "gowerui.log"
	// logMaxBytes es el umbral a partir del cual se rota el log. Un fichero de
	// 1 MiB cubre varias sesiones sin crecer sin control en el disco del
	// usuario; solo se conserva una generación anterior.
	logMaxBytes = 1 << 20
)

// defaultLogPath decide dónde vive el log según la plataforma. Se separa de
// logPath para poder testear cada convención sin tocar el entorno real.
func defaultLogPath(home, goos, xdgStateHome, localAppData string) string {
	switch goos {
	case "windows":
		if localAppData != "" {
			return filepath.Join(localAppData, "gowerui", "logs", logFileName)
		}
		return filepath.Join(home, "AppData", "Local", "gowerui", "logs", logFileName)
	case "darwin":
		return filepath.Join(home, "Library", "Logs", "gowerui", logFileName)
	default:
		if xdgStateHome != "" {
			return filepath.Join(xdgStateHome, "gowerui", logFileName)
		}
		return filepath.Join(home, ".local", "state", "gowerui", logFileName)
	}
}

// logPath devuelve la ruta del log del usuario actual.
func logPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	return defaultLogPath(home, runtime.GOOS, os.Getenv("XDG_STATE_HOME"), os.Getenv("LOCALAPPDATA")), nil
}

// setupLogging redirige el log estándar a stdout y al fichero del usuario.
// Antes todo iba solo a stdout: lanzada desde el menú de aplicaciones nadie ve
// ese stream, así que cualquier fallo era indiagnosticable. Se mantiene stdout
// para que `wails dev` siga mostrando los mensajes en la terminal.
func setupLogging() (string, error) {
	path, err := logPath()
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return path, err
	}

	rotateLog(path)

	// 0600: el log puede contener rutas, ids y mensajes de error del usuario,
	// así que no debe ser legible por otras cuentas de la máquina.
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return path, err
	}
	// Los logs creados por versiones anteriores siguen en 0644; abrir no cambia
	// el modo, así que se corrige aquí.
	_ = file.Chmod(0o600)

	// El fichero se mantiene abierto durante toda la vida del proceso: el
	// MultiWriter lo necesita y cerrarlo aquí dejaría los logs huérfanos.
	log.SetOutput(io.MultiWriter(os.Stdout, file))
	log.SetFlags(log.LstdFlags)

	return path, nil
}

// rotateLog renombra el log a .1 cuando supera el umbral. No es un error que
// falle: si no se puede rotar, se sigue escribiendo en el fichero actual.
func rotateLog(path string) {
	info, err := os.Stat(path)
	if err != nil || info.Size() < logMaxBytes {
		return
	}

	rotated := path + ".1"
	_ = os.Remove(rotated)
	_ = os.Rename(path, rotated)
}

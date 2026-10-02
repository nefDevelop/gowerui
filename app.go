package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx        context.Context
	customPath string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

type AppContext struct {
	CachePath  string `json:"cache_path"`
	ConfigPath string `json:"config_path"`
	UserHome   string `json:"user_home"`
}

// GetAppContext returns paths for cache, config and home
func (a *App) GetAppContext() (AppContext, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return AppContext{}, err
	}

	var configPath, cachePath string
	if runtime.GOOS == "windows" {
		configPath = filepath.Join(home, "AppData", "Roaming", "gower")
		cachePath = filepath.Join(home, "AppData", "Local", "gower", "cache")
	} else {
		configPath = filepath.Join(home, ".config", "gower")
		cachePath = filepath.Join(home, ".cache", "gower")
	}

	// Ensure directories exist
	os.MkdirAll(configPath, 0755)
	os.MkdirAll(cachePath, 0755)

	return AppContext{
		CachePath:  cachePath,
		ConfigPath: configPath,
		UserHome:   home,
	}, nil
}

// RunGowerCommand executes the gower CLI
func (a *App) RunGowerCommand(args []string, background bool) (string, error) {
	// Sin subcomando no hay nada que ejecutar y args[0] entraria en panic.
	if len(args) == 0 {
		return "", fmt.Errorf("no gower command provided: args must contain at least the subcommand")
	}

	gowerPath, err := a.resolveGowerPath()
	if err != nil {
		fmt.Printf("[BACKEND] Error resolving gower path: %v\n", err)
		return "", err
	}

	// Ejecución directa, siempre. Concatenar los argumentos en un `sh -c`
	// convertía cualquier metacaracter en código ejecutable, y los argumentos
	// no son de fiar: `set` recibe un id de proveedor remoto o una ruta del
	// disco, ambas controladas por terceros.
	//
	// El shell no aportaba resolución de entorno: cmd.Env ya hereda el del
	// proceso, y gowerPath es absoluto salvo cuando el usuario configura uno
	// relativo, en cuyo caso exec.Command lo resuelve igual vía PATH.
	fmt.Printf("[BACKEND] Executing: %s %s\n", gowerPath, strings.Join(args, " "))
	cmd := exec.Command(gowerPath, args...)
	cmd.Env = os.Environ() // Ensure process environment is passed

	if background {
		// Buffer for stderr
		var stderr bytes.Buffer
		cmd.Stderr = &stderr
		cmd.Stdout = os.Stdout

		err := cmd.Start()
		if err != nil {
			fmt.Printf("[BACKEND] Error starting background command: %v\n", err)
			return "", err
		}
		go func() {
			err := cmd.Wait()
			if err != nil {
				fmt.Printf("[BACKEND] Background command failed: %v\n[GOWER ERROR] %s\n", err, stderr.String())
			} else {
				fmt.Printf("[BACKEND] Background command finished successfully\n")
			}
			wailsRuntime.EventsEmit(a.ctx, "gower-command-finished", args)
		}()
		return "Backgrounded", nil
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Printf("[BACKEND] Command failed: %v\nOutput: %s\n", err, string(output))
		return string(output), err
	}

	return string(output), nil
}

func (a *App) resolveGowerPath() (string, error) {
	return lookupGowerPath(a.customPath, currentExecutablePath())
}

// lookupGowerPath busca el binario del sidecar en orden de precedencia:
//  1. Ruta configurada en Ajustes.
//  2. Sidecar portable: `gower` junto al ejecutable de la app (o en bin/).
//  3. PATH del sistema.
//  4. Rutas de instalación habituales.
//
// Se separa de resolveGowerPath para poder testear cada rama sin depender del
// ejecutable en ejecución ni de una máquina con gower instalado.
func lookupGowerPath(customPath, exePath string) (string, error) {
	if customPath != "" && isRegularFile(customPath) {
		return customPath, nil
	}

	// Sidecar portable. Va antes del PATH a propósito: en un bundle portable
	// la versión que acompaña al binario es la aprobada para esa release,
	// mientras que el PATH puede apuntar a otra instalación.
	if exePath != "" {
		dir := filepath.Dir(exePath)
		for _, p := range []string{
			filepath.Join(dir, gowerBinaryName()),
			filepath.Join(dir, "bin", gowerBinaryName()),
		} {
			if isRegularFile(p) {
				return p, nil
			}
		}
	}

	if path, err := exec.LookPath(gowerBinaryName()); err == nil {
		return path, nil
	}

	home, _ := os.UserHomeDir()
	for _, dir := range []string{
		filepath.Join(home, "go", "bin"),
		filepath.Join(home, ".local", "bin"),
		"/usr/local/bin",
		"/usr/bin",
	} {
		if p := filepath.Join(dir, gowerBinaryName()); isRegularFile(p) {
			return p, nil
		}
	}

	return "", gowerNotFoundError(customPath)
}

// currentExecutablePath devuelve la ruta del ejecutable de la app resolviendo
// symlinks, o cadena vacía si no se puede determinar.
func currentExecutablePath() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		return resolved
	}
	return exe
}

// gowerBinaryName devuelve el nombre del sidecar según la plataforma.
func gowerBinaryName() string {
	if runtime.GOOS == "windows" {
		return "gower.exe"
	}
	return "gower"
}

// isRegularFile indica si p existe y es un fichero. No se comprueba el bit de
// ejecución: en Windows es irrelevante y en Linux daría falsos negativos en
// montajes sin permisos.
func isRegularFile(p string) bool {
	info, err := os.Stat(p)
	return err == nil && !info.IsDir()
}

// gowerNotFoundError construye un error accionable: en lugar del genérico
// "not found", dice dónde se ha buscado y cómo resolverlo.
func gowerNotFoundError(customPath string) error {
	if customPath != "" {
		return fmt.Errorf(
			"the gower path configured in Settings (%s) does not exist, and gower was not found next to the application, in PATH or in any common location",
			customPath,
		)
	}
	return fmt.Errorf("gower executable not found next to the application, in PATH or in any common location. Install it or select it in Settings")
}

// SetCustomGowerPath sets a custom path for the gower binary
func (a *App) SetCustomGowerPath(path string) {
	a.customPath = path
}

// CheckBattery returns true if a battery is detected
func (a *App) CheckBattery() (bool, error) {
	if runtime.GOOS == "linux" {
		files, err := os.ReadDir("/sys/class/power_supply/")
		if err != nil {
			return false, nil
		}
		for _, f := range files {
			if strings.HasPrefix(f.Name(), "BAT") {
				return true, nil
			}
		}
		return false, nil
	} else if runtime.GOOS == "windows" {
		cmd := exec.Command("powershell", "-NoProfile", "-Command", "Get-WmiObject Win32_Battery | Measure-Object | Select-Object -ExpandProperty Count")
		output, err := cmd.Output()
		if err != nil {
			return false, nil
		}
		countStr := strings.TrimSpace(string(output))
		if countStr != "0" && countStr != "" {
			return true, nil
		}
		return false, nil
	}
	return true, nil // Default for other OS
}

// CheckFileExists checks if a file exists
func (a *App) CheckFileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

// OpenPath opens a file or URL using the system default handler
func (a *App) OpenPath(path string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", path)
	case "darwin":
		cmd = exec.Command("open", path)
	default: // Linux and others
		cmd = exec.Command("xdg-open", path)
	}
	return cmd.Start()
}

// PickFile opens a file dialog to select the gower executable
func (a *App) PickFile() (string, error) {
	return wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Selecciona el ejecutable de Gower",
		Filters: []wailsRuntime.FileFilter{
			{
				DisplayName: "Ejecutables",
				Pattern:     "*.exe;gower;gower-linux;gower-windows*",
			},
		},
	})
}

// PickDirectory opens a directory dialog
func (a *App) PickDirectory() (string, error) {
	return wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Selecciona la carpeta de Wallpapers",
	})
}

// CloseApp hides the window instead of quitting, so it stays in the tray
func (a *App) CloseApp() {
	wailsRuntime.WindowHide(a.ctx)
}

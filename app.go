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
	ctx         context.Context
	customPath  string
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
	gowerPath, err := a.resolveGowerPath()
	if err != nil {
		fmt.Printf("[BACKEND] Error resolving gower path: %v\n", err)
		return "", err
	}

	// For certain commands on Linux, running via shell can help with environment/path resolution
	var cmd *exec.Cmd
	if runtime.GOOS != "windows" && (args[0] == "set" || args[0] == "daemon") {
		fullCmd := fmt.Sprintf("%s %s", gowerPath, strings.Join(args, " "))
		fmt.Printf("[BACKEND] Executing via shell: %s\n", fullCmd)
		cmd = exec.Command("sh", "-c", fullCmd)
	} else {
		fmt.Printf("[BACKEND] Executing direct: %s %s\n", gowerPath, strings.Join(args, " "))
		cmd = exec.Command(gowerPath, args...)
	}
	
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
	if a.customPath != "" {
		return a.customPath, nil
	}

	// Try PATH
	path, err := exec.LookPath("gower")
	if err == nil {
		return path, nil
	}

	// Try common locations
	home, _ := os.UserHomeDir()
	commonPaths := []string{
		filepath.Join(home, "go", "bin", "gower"),
		filepath.Join(home, ".local", "bin", "gower"),
		"/usr/local/bin/gower",
		"/usr/bin/gower",
	}

	for _, p := range commonPaths {
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}

	return "", fmt.Errorf("gower executable not found. Please set it in Settings")
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

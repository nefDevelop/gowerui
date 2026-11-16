package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// backgroundCommandTimeout acota los comandos que no bloquean la UI. Es una
// garantía contra procesos colgados, no un límite de experiencia: por eso es
// holgado. Se declara var para que los tests puedan reducirlo.
var backgroundCommandTimeout = 10 * time.Minute

// commandWaitDelay acota lo que Wait espera a que se cierren stdout/stderr
// después de matar un comando. Sin este tope, un nieto que herede los pipes
// mantiene vivo el Wait y retrasa el aviso de timeout hasta que el nieto
// termine por su cuenta.
var commandWaitDelay = 5 * time.Second

// emitFunc emite un evento de Wails hacia el frontend.
type emitFunc func(eventName string, data ...interface{})

// App struct
type App struct {
	ctx        context.Context
	customPath string
	settings   appSettings

	// tray permite que el cierre de la ventana sepa si existe un icono desde
	// el que reabrirla. Se inicializa en NewApp para que nunca sea nil.
	tray *trayState

	// emit permite sustituir el sistema de eventos de Wails por un doble en los
	// tests. La ruta background de RunGowerCommand emite desde una goroutine, y
	// EventsEmit hace panic si el contexto es nil, así que sin esta inyección
	// ese camino no era testeable.
	emit emitFunc

	// baseCtx es el padre de todos los comandos. Al cerrar la app se cancela
	// para que un gower colgado no sobreviva al cierre del proceso.
	baseCtx    context.Context
	cancelBase context.CancelFunc
}

// appSettings es la configuración propia de la GUI. No forma parte del config de
// gower porque son cosas que gower no necesita saber: dónde vive su propio
// ejecutable, por ejemplo.
type appSettings struct {
	// GowerPath es la ruta del binario de gower elegida en Ajustes. Vacía
	// significa "descúbrelo solo" (junto al ejecutable, PATH, etc.).
	GowerPath string `json:"gower_path"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	// Por defecto no se emite nada: así una App usada sin startup (tests, o
	// cualquier llamada previa a OnStartup) no entra en panic.
	baseCtx, cancelBase := context.WithCancel(context.Background())
	return &App{
		tray:       &trayState{},
		emit:       func(string, ...interface{}) {},
		baseCtx:    baseCtx,
		cancelBase: cancelBase,
	}
}

// shutdown cancela los comandos en vuelo. Wails llama a OnShutdown en todo
// cierre, así que es el último punto donde se pueden matar los hijos que
// siguieran vivos.
func (a *App) shutdown() {
	if a.cancelBase != nil {
		a.cancelBase()
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.emit = func(eventName string, data ...interface{}) {
		wailsRuntime.EventsEmit(ctx, eventName, data...)
	}
	// Recuperar la ruta guardada es lo primero: si el usuario la configuró en
	// una sesión anterior, todas las llamadas a gower dependen de ella.
	if err := a.loadSettings(); err != nil {
		log.Printf("[BACKEND] Could not load settings: %v", err)
	}
}

// settingsPath devuelve la ruta de ~/.config/gowerui/settings.json, creando el
// directorio si hace falta.
func (a *App) settingsPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	dir := filepath.Join(home, ".config", "gowerui")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("could not create config directory %s: %w", dir, err)
	}

	return filepath.Join(dir, "settings.json"), nil
}

// loadSettings lee la configuración desde disco. Un fichero ausente no es un
// error: es el estado por defecto de una app recién instalada.
func (a *App) loadSettings() error {
	path, err := a.settingsPath()
	if err != nil {
		return err
	}

	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}

	var s appSettings
	if err := json.Unmarshal(data, &s); err != nil {
		// Un fichero corrupto no debe dejar la app sin motor: se descarta y se
		// sigue con el autodescubrimiento.
		log.Printf("[BACKEND] Ignoring malformed settings file %s: %v", path, err)
		return nil
	}

	a.settings = s
	a.customPath = s.GowerPath
	return nil
}

// saveSettings escribe la configuración a disco.
func (a *App) saveSettings() error {
	path, err := a.settingsPath()
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(a.settings, "", "  ")
	if err != nil {
		return err
	}

	return writeFileAtomic(path, data, 0o644)
}

// writeFileAtomic escribe data en path sin dejar nunca un fichero a medias: un
// corte de luz a mitad de un os.WriteFile corrompe settings.json, y
// loadSettings descarta un fichero corrupto, así que el usuario perdería su
// configuración sin enterarse. El rename dentro del mismo directorio es
// atómico en las plataformas que soporta la app.
func writeFileAtomic(path string, data []byte, perm os.FileMode) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".tmp-*")
	if err != nil {
		return err
	}

	tmpName := tmp.Name()
	// Si algo falla antes del rename, no se deja basura en el directorio.
	defer func() {
		if tmpName != "" {
			_ = os.Remove(tmpName)
		}
	}()

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	// CreateTemp crea con 0600; el fichero conserva los permisos del original.
	if err := tmp.Chmod(perm); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}

	if err := os.Rename(tmpName, path); err != nil {
		return err
	}
	tmpName = ""

	return nil
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

	// Devolver rutas que no existen rompe las miniaturas y el arranque del
	// daemon más adelante, así que el error se propaga en vez de ignorarse.
	for _, dir := range []string{configPath, cachePath} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return AppContext{}, fmt.Errorf("could not create %s: %w", dir, err)
		}
	}

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
		log.Printf("[BACKEND] Error resolving gower path: %v", err)
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
	log.Printf("[BACKEND] Executing: %s %s", gowerPath, strings.Join(redactedArgs(args), " "))

	// Los comandos en background tienen un tope: un `gower` colgado no puede
	// dejar una goroutine y un proceso vivos indefinidamente. No es un límite de
	// UX, así que es generoso; los comandos en primer plano no lo llevan porque
	// el usuario está esperando su resultado y puede cancelar la acción.
	//
	// Todos cuelgan de baseCtx para que el cierre de la app los cancele.
	baseCtx := a.baseCtx
	if baseCtx == nil {
		baseCtx = context.Background()
	}
	commandCtx := baseCtx
	var cancel context.CancelFunc
	if background {
		commandCtx, cancel = context.WithTimeout(commandCtx, backgroundCommandTimeout)
	} else {
		commandCtx, cancel = context.WithCancel(commandCtx)
		defer cancel()
	}

	cmd := exec.CommandContext(commandCtx, gowerPath, args...)
	cmd.Env = os.Environ() // Ensure process environment is passed
	// Si un descendiente hereda stderr, Wait no vuelve hasta que lo cierre.
	// Con este tope el proceso se mata igualmente y el evento de timeout llega
	// cuando toca en vez de esperar al descendiente.
	cmd.WaitDelay = commandWaitDelay

	if background {
		// Buffer for stderr
		var stderr bytes.Buffer
		cmd.Stderr = &stderr
		cmd.Stdout = os.Stdout

		err := cmd.Start()
		if err != nil {
			cancel()
			log.Printf("[BACKEND] Error starting background command: %v", err)
			return "", err
		}
		go func() {
			// El contexto se libera aquí, no al volver de esta función: hacerlo
			// antes mataría el comando recién lanzado.
			defer cancel()

			err := normalizeWaitDelayError(cmd.Wait())
			if err != nil {
				failure := summarizeGowerError(stderr.String())
				if errors.Is(commandCtx.Err(), context.DeadlineExceeded) {
					failure = fmt.Sprintf("gower %s timed out after %s", args[0], backgroundCommandTimeout)
				}

				log.Printf("[BACKEND] Background command failed: %v\n[GOWER ERROR] %s", err, stderr.String())
				// El fallo viaja al frontend: sin esto el usuario veía cómo la
				// acción no hacía nada y el motivo solo quedaba en stdout.
				a.emit("gower-command-failed", backgroundCommandFailure{
					Args:  args,
					Error: failure,
				})
			} else {
				log.Println("[BACKEND] Background command finished successfully")
			}
			a.emit("gower-command-finished", args)
		}()
		return "Backgrounded", nil
	}

	output, err := cmd.CombinedOutput()
	err = normalizeWaitDelayError(err)
	if err != nil {
		log.Printf("[BACKEND] Command failed: %v\nOutput: %s", err, string(output))
		return string(output), err
	}

	return string(output), nil
}

// normalizeWaitDelayError trata exec.ErrWaitDelay como éxito. Ese error solo
// aparece cuando el comando terminó con código 0 pero dejó un descendiente con
// los pipes abiertos (por ejemplo, un `daemon start` que se desacopla): el
// comando hizo su trabajo y no debe convertirse en un toast de error.
func normalizeWaitDelayError(err error) error {
	if errors.Is(err, exec.ErrWaitDelay) {
		return nil
	}
	return err
}

// redactedArgs devuelve una copia de los argumentos con los secretos tapados,
// para que el log no guarde API keys. El log es un fichero del usuario que se
// adjunta en los informes de error, así que no puede contener credenciales.
func redactedArgs(args []string) []string {
	safe := append([]string(nil), args...)

	if len(safe) < 2 || safe[0] != "config" {
		return safe
	}

	switch safe[1] {
	case "set":
		// config set <key>=<value>
		for i := 2; i < len(safe); i++ {
			key, _, ok := strings.Cut(safe[i], "=")
			if ok && isSensitiveConfigKey(key) {
				safe[i] = key + "=<redacted>"
			}
		}
	case "provider":
		// config provider add <name> <url> [key]
		if len(safe) >= 6 && safe[2] == "add" {
			safe[5] = "<redacted>"
		}
	}

	return safe
}

// isSensitiveConfigKey reconoce las claves de configuración cuyo valor es una
// credencial. Se compara el último tramo para cubrir tanto `api_key` como
// `providers.unsplash.api_key`.
func isSensitiveConfigKey(key string) bool {
	lower := strings.ToLower(key)
	if i := strings.LastIndex(lower, "."); i >= 0 {
		lower = lower[i+1:]
	}

	switch lower {
	case "api_key", "apikey", "key", "secret", "token", "password", "passwd":
		return true
	}

	for _, suffix := range []string{"_key", "_secret", "_token", "_password"} {
		if strings.HasSuffix(lower, suffix) {
			return true
		}
	}

	return false
}

func (a *App) resolveGowerPath() (string, error) {
	return lookupGowerPath(a.customPath, currentExecutablePath())
}

// backgroundCommandFailure es el payload de `gower-command-failed`, que se
// emite solo cuando un comando en background termina con error. Se separan los
// argumentos y la causa para que la UI pueda contextualizar el aviso sin
// parsear texto libre.
type backgroundCommandFailure struct {
	Args  []string `json:"args"`
	Error string   `json:"error"`
}

// summarizeGowerError reduce el stderr de gower a la línea que explica el
// fallo. El CLI mezcla logs con timestamp, el bloque de ayuda de cobra y el
// mensaje final de error, así que volcar el stderr entero en un toast es
// ilegible. Se prefiere la línea "Error: ..." y, si no la hay, la última línea
// con contenido.
func summarizeGowerError(stderr string) string {
	const maxLen = 240

	fallback := ""
	for _, raw := range strings.Split(stderr, "\n") {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		fallback = line
		if strings.HasPrefix(strings.ToLower(line), "error:") {
			return truncateText(strings.TrimSpace(line[len("error:"):]), maxLen)
		}
	}
	return truncateText(fallback, maxLen)
}

// truncateText recorta por runas para no partir un carácter multibyte a mitad.
func truncateText(text string, max int) string {
	runes := []rune(text)
	if len(runes) <= max {
		return text
	}
	return strings.TrimSpace(string(runes[:max-1])) + "…"
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

// version es la versión de la aplicación, inyectada en tiempo de build con
// -ldflags "-X main.version=...". El Makefile y el workflow la leen de
// wails.json, que es la fuente de verdad. Sin inyección vale "dev".
var version = "dev"

// GetAppVersion returns the application version shown in the UI.
func (a *App) GetAppVersion() string {
	return version
}

// GowerStatus describes what the app knows about the gower binary, so the UI can
// tell the user where it was found, or what it has configured, or what is wrong.
type GowerStatus struct {
	// ResolvedPath is the binary that would be used right now, empty if none was
	// found.
	ResolvedPath string `json:"resolved_path"`
	// ConfiguredPath is the path set in Settings, empty if relying on discovery.
	ConfiguredPath string `json:"configured_path"`
	// Available is false when gower cannot be found at all.
	Available bool `json:"available"`
	// Error carries the reason when Available is false.
	Error string `json:"error"`
}

// GetGowerStatus returns where gower is, and whether it can be found at all.
func (a *App) GetGowerStatus() GowerStatus {
	status := GowerStatus{ConfiguredPath: a.settings.GowerPath}

	resolved, err := a.resolveGowerPath()
	if err != nil {
		status.Available = false
		status.Error = err.Error()
		return status
	}

	status.Available = true
	status.ResolvedPath = resolved
	return status
}

// SetCustomGowerPath sets and persists a custom path for the gower binary.
// An empty path clears the setting and goes back to automatic discovery.
func (a *App) SetCustomGowerPath(path string) error {
	if path != "" && !isRegularFile(path) {
		return fmt.Errorf("no such file: %s", path)
	}

	a.settings.GowerPath = path
	a.customPath = path

	if err := a.saveSettings(); err != nil {
		// El path se queda aplicado en memoria aunque no se pueda persistir:
		// es mejor que la app funcione en esta sesión que no funcionar.
		log.Printf("[BACKEND] Could not persist settings: %v", err)
		return err
	}

	return nil
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
		// Get-CimInstance sustituye a Get-WmiObject, retirado en Windows 11
		// recientes; con el anterior la detección devolvía false en silencio.
		cmd := exec.Command("powershell", "-NoProfile", "-Command", "Get-CimInstance Win32_Battery | Measure-Object | Select-Object -ExpandProperty Count")
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
	// Un error de permisos no significa que exista: os.IsNotExist lo daba por
	// bueno y la UI intentaba abrir un fichero que no podía leer.
	_, err := os.Stat(path)
	return err == nil
}

// OpenPath opens a file or URL using the system default handler
func (a *App) OpenPath(path string) error {
	return openWithSystemHandler(path)
}

// openWithSystemHandler lanza el handler del sistema sin bloquear la UI. El
// Wait va en su propia goroutine: sin recolectar el hijo, cada apertura dejaba
// un proceso zombi.
func openWithSystemHandler(path string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", path)
	case "darwin":
		cmd = exec.Command("open", path)
	default: // Linux and others
		cmd = exec.Command("xdg-open", path)
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	go func() { _ = cmd.Wait() }()
	return nil
}

// GetLogPath returns the path of the application log file.
func (a *App) GetLogPath() string {
	path, err := logPath()
	if err != nil {
		return ""
	}
	return path
}

// OpenLogFile opens the application log with the system handler, creating an
// empty file when logging to disk has not produced one yet. Esto es lo que
// convierte un fallo reportado por un usuario en algo diagnosticable.
func (a *App) OpenLogFile() error {
	path := a.GetLogPath()
	if path == "" {
		return errors.New("could not determine the log file location")
	}

	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return err
		}

		file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY, 0o644)
		if err != nil {
			return err
		}
		file.Close()
	}

	return openWithSystemHandler(path)
}

// PickFile opens a file dialog to select the gower executable. The title is
// passed in so the caller can localise it: a native dialog is not covered by
// the frontend i18n.
func (a *App) PickFile(title string) (string, error) {
	return wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: title,
		Filters: []wailsRuntime.FileFilter{
			{
				DisplayName: "Executables",
				Pattern:     "*.exe;gower;gower-linux;gower-windows*",
			},
		},
	})
}

// PickDirectory opens a directory dialog. The title is passed in so the caller
// can localise it.
func (a *App) PickDirectory(title string) (string, error) {
	return wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: title,
	})
}

// CloseApp hides the window when there is a tray icon to come back from, and
// quits otherwise: hiding without a tray would strand the process.
func (a *App) CloseApp() {
	if a.tray.shouldHideOnClose() {
		wailsRuntime.WindowHide(a.ctx)
		return
	}

	a.tray.markQuitting()
	wailsRuntime.Quit(a.ctx)
}

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeGowerAt crea un script ejecutable falso en la ruta indicada, sin tocar
// el PATH. Lo usan los tests del sidecar portable, donde la ubicación la fija
// el directorio del ejecutable de la app.
func fakeGowerAt(t *testing.T, path string) string {
	t.Helper()

	if runtime.GOOS == "windows" {
		t.Skip("requiere un shell POSIX para generar el binario falso")
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("no se pudo crear el directorio de %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatalf("no se pudo crear el fake de gower en %s: %v", path, err)
	}
	return path
}

// fakeGower crea un ejecutable falso con la salida indicada y lo expone como
// único candidato en el PATH del test. Aísla la resolución del binario real de
// la máquina donde se ejecutan los tests.
func fakeGower(t *testing.T, script string) string {
	t.Helper()

	dir := t.TempDir()
	path := fakeGowerAt(t, filepath.Join(dir, gowerBinaryName()))

	if err := os.WriteFile(path, []byte("#!/bin/sh\n"+script), 0o755); err != nil {
		t.Fatalf("no se pudo escribir el script del fake: %v", err)
	}

	// PATH restringido: solo el directorio del fake, nada del host.
	t.Setenv("PATH", dir)

	return path
}

// isolateHome apunta HOME y USERPROFILE a un directorio temporal vacío, para que
// los tests que tocan la configuración de la GUI no lean ni escriban el
// settings.json real del usuario.
func isolateHome(t *testing.T) {
	t.Helper()

	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
}

// isolateHostWithoutGower limpia el entorno y verifica que no exista un gower
// real donde lo buscaría resolveGowerPath. Si lo hay, el escenario "no
// encontrado" no es reproducible y el test se omite en lugar de dar un falso
// positivo.
func isolateHostWithoutGower(t *testing.T) {
	t.Helper()

	isolateHome(t)
	t.Setenv("PATH", filepath.Join(t.TempDir(), "empty-bin"))

	for _, p := range []string{"/usr/local/bin/gower", "/usr/bin/gower"} {
		if _, err := os.Stat(p); err == nil {
			t.Skipf("gower instalado en %s: no se puede garantizar el escenario", p)
		}
	}

	// resolveGowerPath también mira junto al ejecutable de la app, que en un
	// test es el binario de go test.
	if exe, err := os.Executable(); err == nil {
		sidecar := filepath.Join(filepath.Dir(exe), gowerBinaryName())
		if _, err := os.Stat(sidecar); err == nil {
			t.Skipf("gower junto al binario de test en %s: no se puede garantizar el escenario", sidecar)
		}
	}
}

func TestNewAppStartsWithoutCustomPath(t *testing.T) {
	app := NewApp()

	if app.customPath != "" {
		t.Errorf("customPath = %q, se esperaba vacío", app.customPath)
	}
}

// Sin -ldflags la versión vale "dev"; el Makefile y el workflow la inyectan
// leyendo wails.json. Este test documenta ese contrato.
func TestVersionFallsBackToDev(t *testing.T) {
	if version != "dev" {
		t.Errorf("version = %q, se esperaba \"dev\" cuando no hay inyección por ldflags", version)
	}
}

func TestGetAppVersion(t *testing.T) {
	if got := NewApp().GetAppVersion(); got != version {
		t.Errorf("GetAppVersion() = %q, se esperaba %q", got, version)
	}
}

// Una App recién creada debe poder emitir sin contexto de Wails: si no, el path
// background revienta antes de que arranque OnStartup.
func TestNewAppEmitIsSafeByDefault(t *testing.T) {
	app := NewApp()
	if app.emit == nil {
		t.Fatal("NewApp() debe dejar un emit no-op, no nil")
	}
	app.emit("cualquier-evento", []string{"a"})
}

func TestSetCustomGowerPath(t *testing.T) {
	// Un PATH válido con otro gower no debe ganar al path configurado.
	fakeGower(t, "exit 0")
	custom := fakeGowerAt(t, filepath.Join(t.TempDir(), "custom-gower"))
	isolateHome(t)

	app := NewApp()
	if err := app.SetCustomGowerPath(custom); err != nil {
		t.Fatalf("SetCustomGowerPath() error inesperado: %v", err)
	}

	if app.customPath != custom {
		t.Fatalf("customPath = %q, se esperaba %q", app.customPath, custom)
	}

	got, err := app.resolveGowerPath()
	if err != nil {
		t.Fatalf("resolveGowerPath() error inesperado: %v", err)
	}
	if got != custom {
		t.Errorf("resolveGowerPath() = %q, se esperaba el path configurado %q", got, custom)
	}
}

func TestSetCustomGowerPathRejectsMissingFile(t *testing.T) {
	isolateHome(t)
	app := NewApp()

	missing := filepath.Join(t.TempDir(), "gower-inexistente")

	if err := app.SetCustomGowerPath(missing); err == nil {
		t.Fatal("se esperaba error al guardar una ruta que no existe")
	}
	if app.customPath != "" {
		t.Errorf("customPath = %q, un path inválido no debe aplicarse", app.customPath)
	}
}

func TestSetCustomGowerPathRejectsDirectory(t *testing.T) {
	isolateHome(t)
	dir := t.TempDir()
	app := NewApp()

	if err := app.SetCustomGowerPath(dir); err == nil {
		t.Fatal("se esperaba error al guardar un directorio")
	}
}

func TestSetCustomGowerPathPersistsAcrossRestarts(t *testing.T) {
	isolateHome(t)
	custom := fakeGowerAt(t, filepath.Join(t.TempDir(), "custom-gower"))

	first := NewApp()
	if err := first.SetCustomGowerPath(custom); err != nil {
		t.Fatalf("SetCustomGowerPath() error inesperado: %v", err)
	}

	// App nueva, mismo HOME: debe recuperar el path del disco.
	second := NewApp()
	if err := second.loadSettings(); err != nil {
		t.Fatalf("loadSettings() error inesperado: %v", err)
	}

	if second.customPath != custom {
		t.Errorf("customPath tras reiniciar = %q, se esperaba %q", second.customPath, custom)
	}

	got, err := second.resolveGowerPath()
	if err != nil {
		t.Fatalf("resolveGowerPath() error inesperado: %v", err)
	}
	if got != custom {
		t.Errorf("resolveGowerPath() = %q, se esperaba el path recuperado %q", got, custom)
	}
}

func TestSetCustomGowerPathEmptyClearsSetting(t *testing.T) {
	isolateHome(t)
	custom := fakeGowerAt(t, filepath.Join(t.TempDir(), "custom-gower"))

	app := NewApp()
	if err := app.SetCustomGowerPath(custom); err != nil {
		t.Fatalf("SetCustomGowerPath() error inesperado: %v", err)
	}

	if err := app.SetCustomGowerPath(""); err != nil {
		t.Fatalf("SetCustomGowerPath(\"\") error inesperado: %v", err)
	}

	if app.customPath != "" {
		t.Errorf("customPath = %q, se esperaba vacío", app.customPath)
	}

	// Y el valor persistido también debe estar limpio.
	reloaded := NewApp()
	if err := reloaded.loadSettings(); err != nil {
		t.Fatalf("loadSettings() error inesperado: %v", err)
	}
	if reloaded.customPath != "" {
		t.Errorf("customPath tras recargar = %q, se esperaba vacío", reloaded.customPath)
	}
}

func TestLoadSettingsWithoutFileIsNotAnError(t *testing.T) {
	isolateHome(t)

	app := NewApp()
	if err := app.loadSettings(); err != nil {
		t.Errorf("loadSettings() = %v, un HOME vacío no debe dar error", err)
	}
	if app.customPath != "" {
		t.Errorf("customPath = %q, se esperaba vacío", app.customPath)
	}
}

// Un settings.json corrupto no debe dejar la app sin motor: se descarta y se
// sigue con el autodescubrimiento.
func TestLoadSettingsIgnoresMalformedFile(t *testing.T) {
	isolateHome(t)

	path, err := (&App{}).settingsPath()
	if err != nil {
		t.Fatalf("settingsPath() error inesperado: %v", err)
	}
	if err := os.WriteFile(path, []byte("{no es json"), 0o644); err != nil {
		t.Fatalf("no se pudo escribir el fichero corrupto: %v", err)
	}

	// El autodescubrimiento debe seguir funcionando.
	found := fakeGower(t, "exit 0")

	app := NewApp()
	if err := app.loadSettings(); err != nil {
		t.Errorf("loadSettings() = %v, un fichero corrupto no debe propagar error", err)
	}

	got, err := app.resolveGowerPath()
	if err != nil {
		t.Fatalf("resolveGowerPath() error inesperado tras fichero corrupto: %v", err)
	}
	if got != found {
		t.Errorf("resolveGowerPath() = %q, se esperaba el gower del PATH %q", got, found)
	}
}

func TestSettingsFileIsValidJSON(t *testing.T) {
	isolateHome(t)
	custom := fakeGowerAt(t, filepath.Join(t.TempDir(), "custom-gower"))

	app := NewApp()
	if err := app.SetCustomGowerPath(custom); err != nil {
		t.Fatalf("SetCustomGowerPath() error inesperado: %v", err)
	}

	path, err := app.settingsPath()
	if err != nil {
		t.Fatalf("settingsPath() error inesperado: %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("no se pudo leer %s: %v", path, err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("el fichero escrito no es JSON válido: %v\n%s", err, data)
	}
	if parsed["gower_path"] != custom {
		t.Errorf("gower_path = %v, se esperaba %q", parsed["gower_path"], custom)
	}
}

func TestGetGowerStatusReportsResolvedPath(t *testing.T) {
	// Aislamos HOME antes de crear el fake: fakeGower toca el PATH y el HOME
	// debe seguir limpio para que el test sea determinista.
	isolateHostWithoutGower(t)
	found := fakeGower(t, "exit 0")

	app := NewApp()

	status := app.GetGowerStatus()
	if !status.Available {
		t.Fatalf("Available = false, se esperaba true. Error: %s", status.Error)
	}
	if status.ResolvedPath != found {
		t.Errorf("ResolvedPath = %q, se esperaba %q", status.ResolvedPath, found)
	}
	if status.ConfiguredPath != "" {
		t.Errorf("ConfiguredPath = %q, se esperaba vacío", status.ConfiguredPath)
	}
	if status.Error != "" {
		t.Errorf("Error = %q, se esperaba vacío cuando está disponible", status.Error)
	}
}

func TestGetGowerStatusReportsConfiguredPath(t *testing.T) {
	isolateHome(t)
	custom := fakeGowerAt(t, filepath.Join(t.TempDir(), "custom-gower"))

	app := NewApp()
	if err := app.SetCustomGowerPath(custom); err != nil {
		t.Fatalf("SetCustomGowerPath() error inesperado: %v", err)
	}

	status := app.GetGowerStatus()
	if status.ConfiguredPath != custom {
		t.Errorf("ConfiguredPath = %q, se esperaba %q", status.ConfiguredPath, custom)
	}
	if !status.Available {
		t.Errorf("Available = false, se esperaba true. Error: %s", status.Error)
	}
}

func TestGetGowerStatusReportsMissingBinary(t *testing.T) {
	isolateHostWithoutGower(t)

	app := NewApp()

	status := app.GetGowerStatus()
	if status.Available {
		t.Fatal("Available = true, se esperaba false")
	}
	if status.ResolvedPath != "" {
		t.Errorf("ResolvedPath = %q, se esperaba vacío", status.ResolvedPath)
	}
	if status.Error == "" {
		t.Error("Error vacío: la UI necesita saber por qué no está disponible")
	}
}

// El bundle portable distribuido por el release trae `gower` como fichero
// hermano de `gowerui`. Si no lo buscamos ahí, la app arranca sin motor.
func TestLookupGowerPathPrefersSidecarNextToExecutable(t *testing.T) {
	sidecar := fakeGowerAt(t, filepath.Join(t.TempDir(), gowerBinaryName()))
	appDir := filepath.Dir(sidecar)
	exe := filepath.Join(appDir, "gowerui")

	// Hay otro gower en el PATH: el sidecar de la release debe ganar.
	installed := fakeGower(t, "exit 0")

	got, err := lookupGowerPath("", exe)
	if err != nil {
		t.Fatalf("lookupGowerPath() error inesperado: %v", err)
	}
	if got != sidecar {
		t.Errorf("lookupGowerPath() = %q, se esperaba el sidecar %q (PATH tenía %q)", got, sidecar, installed)
	}
}

func TestLookupGowerPathFindsSidecarInBinSubdirectory(t *testing.T) {
	sidecar := fakeGowerAt(t, filepath.Join(t.TempDir(), "bin", gowerBinaryName()))
	exe := filepath.Join(filepath.Dir(filepath.Dir(sidecar)), "gowerui")
	t.Setenv("PATH", t.TempDir())

	got, err := lookupGowerPath("", exe)
	if err != nil {
		t.Fatalf("lookupGowerPath() error inesperado: %v", err)
	}
	if got != sidecar {
		t.Errorf("lookupGowerPath() = %q, se esperaba %q", got, sidecar)
	}
}

func TestLookupGowerPathFallsBackToPathWithoutSidecar(t *testing.T) {
	installed := fakeGower(t, "exit 0")

	// App en un directorio sin sidecar.
	exe := filepath.Join(t.TempDir(), "gowerui")

	got, err := lookupGowerPath("", exe)
	if err != nil {
		t.Fatalf("lookupGowerPath() error inesperado: %v", err)
	}
	if got != installed {
		t.Errorf("lookupGowerPath() = %q, se esperaba el gower del PATH %q", got, installed)
	}
}

// Un directorio llamado `gower` no es un ejecutable: intentarlo daría un error
// confuso en tiempo de ejecución.
func TestLookupGowerPathIgnoresDirectoryNamedGower(t *testing.T) {
	appDir := t.TempDir()
	if err := os.Mkdir(filepath.Join(appDir, gowerBinaryName()), 0o755); err != nil {
		t.Fatalf("no se pudo crear el directorio señuelo: %v", err)
	}
	installed := fakeGower(t, "exit 0")

	got, err := lookupGowerPath("", filepath.Join(appDir, "gowerui"))
	if err != nil {
		t.Fatalf("lookupGowerPath() error inesperado: %v", err)
	}
	if got != installed {
		t.Errorf("lookupGowerPath() = %q, un directorio no debe ganar: se esperaba %q", got, installed)
	}
}

// Si la ruta de Ajustes apunta a algo que ya no existe, la app debe seguir
// funcionando con el sidecar o el PATH antes de rendirse.
func TestLookupGowerPathIgnoresInvalidCustomPath(t *testing.T) {
	sidecar := fakeGowerAt(t, filepath.Join(t.TempDir(), gowerBinaryName()))

	got, err := lookupGowerPath(filepath.Join(t.TempDir(), "gower-borrado"), sidecar)
	if err != nil {
		t.Fatalf("lookupGowerPath() error inesperado: %v", err)
	}
	if got != sidecar {
		t.Errorf("lookupGowerPath() = %q, se esperaba el sidecar %q", got, sidecar)
	}
}

func TestLookupGowerPathFailsWhenBinaryMissing(t *testing.T) {
	isolateHostWithoutGower(t)

	_, err := lookupGowerPath("", filepath.Join(t.TempDir(), "gowerui"))
	if err == nil {
		t.Fatal("se esperaba error cuando no hay ningún gower")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("el error no menciona que no se encontró: %v", err)
	}
	// El mensaje debe decir cómo resolverlo, no solo qué falló.
	if !strings.Contains(err.Error(), "Settings") {
		t.Errorf("el error no indica cómo resolverlo: %v", err)
	}
}

func TestGowerNotFoundErrorMentionsInvalidCustomPath(t *testing.T) {
	err := gowerNotFoundError("/home/user/rutas/obsoletas/gower")

	if !strings.Contains(err.Error(), "/home/user/rutas/obsoletas/gower") {
		t.Errorf("el error no menciona el path configurado: %v", err)
	}
}

func TestGowerBinaryNamePerPlatform(t *testing.T) {
	want := "gower"
	if runtime.GOOS == "windows" {
		want = "gower.exe"
	}
	if got := gowerBinaryName(); got != want {
		t.Errorf("gowerBinaryName() = %q, se esperaba %q en %s", got, want, runtime.GOOS)
	}
}

// La búsqueda del sidecar portable depende de esto: si currentExecutablePath
// fallara, lookupGowerPath se quedaría sin poder mirar junto al binario.
func TestCurrentExecutablePathIsUsable(t *testing.T) {
	got := currentExecutablePath()

	if got == "" {
		t.Fatal("currentExecutablePath() devolvió vacío")
	}
	if !filepath.IsAbs(got) {
		t.Errorf("currentExecutablePath() = %q, se esperaba una ruta absoluta", got)
	}
	if !isRegularFile(got) {
		t.Errorf("currentExecutablePath() = %q, no apunta a un fichero existente", got)
	}
}

func TestResolveGowerPathFindsBinaryInPATH(t *testing.T) {
	isolateHostWithoutGower(t)
	// isolateHostWithoutGower deja el PATH vacío, así que el fake se crea
	// después y vuelve a fijar el PATH a su propio directorio.
	want := fakeGower(t, "exit 0")

	app := NewApp()

	got, err := app.resolveGowerPath()
	if err != nil {
		t.Fatalf("resolveGowerPath() error inesperado: %v", err)
	}
	if got != want {
		t.Errorf("resolveGowerPath() = %q, se esperaba %q", got, want)
	}
}

func TestRunGowerCommandReturnsOutput(t *testing.T) {
	fakeGower(t, `echo '{"wallpapers":2}'`)

	app := NewApp()

	out, err := app.RunGowerCommand([]string{"status", "--json"}, false)
	if err != nil {
		t.Fatalf("RunGowerCommand() error inesperado: %v", err)
	}
	if strings.TrimSpace(out) != `{"wallpapers":2}` {
		t.Errorf("salida = %q, se esperaba el JSON del script", out)
	}
}

func TestRunGowerCommandForwardsArguments(t *testing.T) {
	// El script imprime sus propios argumentos para verificar el forwarding.
	fakeGower(t, `echo "args:$*"`)

	app := NewApp()

	out, err := app.RunGowerCommand([]string{"feed", "show", "--page", "2"}, false)
	if err != nil {
		t.Fatalf("RunGowerCommand() error inesperado: %v", err)
	}
	if want := "args:feed show --page 2"; strings.TrimSpace(out) != want {
		t.Errorf("argumentos = %q, se esperaba %q", strings.TrimSpace(out), want)
	}
}

func TestRunGowerCommandPropagatesFailure(t *testing.T) {
	fakeGower(t, `echo "boom" >&2; exit 3`)

	app := NewApp()

	out, err := app.RunGowerCommand([]string{"status"}, false)
	if err == nil {
		t.Fatal("se esperaba error cuando el comando sale con código 3")
	}
	// CombinedOutput debe conservar la salida para que la UI pueda mostrarla.
	if !strings.Contains(out, "boom") {
		t.Errorf("la salida no contiene stderr: %q", out)
	}
}

// Los argumentos de `set` vienen de proveedores remotos (ids del feed) o del
// sistema de ficheros (rutas locales), así que no son de fiar. Este test falla
// si alguien reintroduce la ejecución vía `sh -c`: en ese caso el payload se
// interpreta y se crea el fichero marcador.
func TestRunGowerCommandDoesNotInterpretShellMetacharacters(t *testing.T) {
	payloads := []struct {
		name string
		arg  string
	}{
		{"command chaining", "wallpaper; touch %s"},
		{"command substitution", "wallpaper $(touch %s)"},
		{"backticks", "wallpaper `touch %s`"},
		{"background and redirect", "wallpaper & touch %s > /dev/null"},
		{"pipe", "wallpaper | touch %s"},
	}

	for _, tt := range payloads {
		t.Run(tt.name, func(t *testing.T) {
			marker := filepath.Join(t.TempDir(), "pwned")
			fakeGower(t, `echo "args:$*"`)

			app := NewApp()

			malicious := fmt.Sprintf(tt.arg, marker)
			out, err := app.RunGowerCommand([]string{"set", malicious}, false)
			if err != nil {
				t.Fatalf("RunGowerCommand() error inesperado: %v", err)
			}

			if _, statErr := os.Stat(marker); statErr == nil {
				t.Fatalf("el payload %q se ejecutó: se creó %s", malicious, marker)
			}

			// El argumento debe llegar literal, sin trocear ni expandir.
			if !strings.Contains(out, malicious) {
				t.Errorf("el argumento no llegó literal.\n salida:    %q\n esperado:  %q", out, malicious)
			}
		})
	}
}

// La rama de shell se aplicaba a `set` y `daemon`; el resto ya iba directo.
// Este caso fija que `daemon` tampoco se ejecuta vía shell.
func TestRunGowerCommandDoesNotUseShellForDaemonCommands(t *testing.T) {
	marker := filepath.Join(t.TempDir(), "pwned")
	fakeGower(t, `echo "args:$*"`)

	app := NewApp()

	malicious := "start; touch " + marker
	if _, err := app.RunGowerCommand([]string{"daemon", malicious}, false); err != nil {
		t.Fatalf("RunGowerCommand() error inesperado: %v", err)
	}

	if _, err := os.Stat(marker); err == nil {
		t.Errorf("el payload de daemon se ejecutó: se creó %s", marker)
	}
}

func TestRunGowerCommandFailsWhenBinaryMissing(t *testing.T) {
	isolateHostWithoutGower(t)

	app := NewApp()

	out, err := app.RunGowerCommand([]string{"status"}, false)
	if err == nil {
		t.Fatalf("se esperaba error, se obtuvo salida %q", out)
	}
	if out != "" {
		t.Errorf("salida = %q, se esperaba cadena vacía", out)
	}
}

// El frontend puede invocar el binding con un array vacío: antes esto hacía
// panic al leer args[0].
func TestRunGowerCommandRejectsEmptyArgs(t *testing.T) {
	isolateHostWithoutGower(t)

	app := NewApp()

	out, err := app.RunGowerCommand([]string{}, false)
	if err == nil {
		t.Fatalf("se esperaba error con args vacío, se obtuvo salida %q", out)
	}
	if !strings.Contains(err.Error(), "no gower command") {
		t.Errorf("mensaje inesperado: %v", err)
	}
	if out != "" {
		t.Errorf("salida = %q, se esperaba cadena vacía", out)
	}
}

// emittedEvent captura lo que se emite por el sistema de eventos de Wails.
type emittedEvent struct {
	name string
	data []interface{}
}

// recorder de eventos para poder testear la ruta background, que lanza una
// goroutine y emite al terminar.
type eventRecorder struct {
	mu     sync.Mutex
	events []emittedEvent
}

func (r *eventRecorder) emit(name string, data ...interface{}) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, emittedEvent{name: name, data: data})
}

// wait bloquea hasta que se ha emitido un evento o se agota el plazo. La
// goroutine de RunGowerCommand es asíncrona, así que el test no puede assume
// que el evento ya está emitido cuando retorna la llamada.
func (r *eventRecorder) wait(t *testing.T, timeout time.Duration) emittedEvent {
	t.Helper()

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		r.mu.Lock()
		n := len(r.events)
		r.mu.Unlock()

		if n > 0 {
			r.mu.Lock()
			defer r.mu.Unlock()
			return r.events[0]
		}
		time.Sleep(2 * time.Millisecond)
	}

	t.Fatalf("no se emitió ningún evento en %s", timeout)
	return emittedEvent{}
}

func TestRunGowerCommandBackgroundEmitsFinishedEvent(t *testing.T) {
	fakeGower(t, "exit 0")

	recorder := &eventRecorder{}
	app := NewApp()
	app.emit = recorder.emit

	out, err := app.RunGowerCommand([]string{"set", "abc123"}, true)
	if err != nil {
		t.Fatalf("RunGowerCommand() error inesperado: %v", err)
	}
	if out != "Backgrounded" {
		t.Errorf("salida = %q, se esperaba %q", out, "Backgrounded")
	}

	evt := recorder.wait(t, 5*time.Second)
	if evt.name != "gower-command-finished" {
		t.Errorf("evento = %q, se esperaba %q", evt.name, "gower-command-finished")
	}

	// El frontend inspecciona los args para decidir qué refrescar.
	if len(evt.data) != 1 {
		t.Fatalf("data = %v, se esperaba un único argumento", evt.data)
	}
	args, ok := evt.data[0].([]string)
	if !ok {
		t.Fatalf("data[0] = %T, se esperaba []string", evt.data[0])
	}
	if len(args) != 2 || args[0] != "set" || args[1] != "abc123" {
		t.Errorf("args = %v, se esperaba [set abc123]", args)
	}
}

// Aunque el comando en background falle, el evento debe emitirse: es lo que
// refresca la UI y la deja coherent con el error.
func TestRunGowerCommandBackgroundEmitsEvenOnFailure(t *testing.T) {
	fakeGower(t, `echo "boom" >&2; exit 1`)

	recorder := &eventRecorder{}
	app := NewApp()
	app.emit = recorder.emit

	if _, err := app.RunGowerCommand([]string{"set", "x"}, true); err != nil {
		t.Fatalf("RunGowerCommand() error inesperado: %v", err)
	}

	if evt := recorder.wait(t, 5*time.Second); evt.name != "gower-command-finished" {
		t.Errorf("evento = %q, se esperaba %q pese al fallo", evt.name, "gower-command-finished")
	}
}

func TestRunGowerCommandSynchronousDoesNotEmit(t *testing.T) {
	fakeGower(t, "exit 0")

	recorder := &eventRecorder{}
	app := NewApp()
	app.emit = recorder.emit

	if _, err := app.RunGowerCommand([]string{"status"}, false); err != nil {
		t.Fatalf("RunGowerCommand() error inesperado: %v", err)
	}

	// El frontend solo escucha este evento para el path background.
	recorder.mu.Lock()
	n := len(recorder.events)
	recorder.mu.Unlock()

	if n != 0 {
		t.Errorf("se emitieron %d eventos en una llamada síncrona, se esperaba 0", n)
	}
}

// Una App usada sin startup (o con el contexto de Wails aún no disponible) no
// debe entrar en panic al emitir.
func TestRunGowerCommandBackgroundWithoutWailsContextDoesNotPanic(t *testing.T) {
	fakeGower(t, "exit 0")

	// NewApp deja un emit no-op por defecto, sin tocar el contexto de Wails.
	app := NewApp()
	app.ctx = nil

	done := make(chan struct{})
	go func() {
		defer close(done)
		if _, err := app.RunGowerCommand([]string{"set", "x"}, true); err != nil {
			t.Errorf("RunGowerCommand() error inesperado: %v", err)
		}
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("RunGowerCommand() en background no retornó")
	}
}

func TestGetAppContextCreatesDirectories(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)

	app := NewApp()

	appCtx, err := app.GetAppContext()
	if err != nil {
		t.Fatalf("GetAppContext() error inesperado: %v", err)
	}

	if appCtx.UserHome != home {
		t.Errorf("UserHome = %q, se esperaba %q", appCtx.UserHome, home)
	}
	for name, dir := range map[string]string{
		"ConfigPath": appCtx.ConfigPath,
		"CachePath":  appCtx.CachePath,
	} {
		if dir == "" {
			t.Errorf("%s vacío", name)
			continue
		}
		if !filepath.IsAbs(dir) {
			t.Errorf("%s = %q, se esperaba una ruta absoluta", name, dir)
		}
		info, err := os.Stat(dir)
		if err != nil {
			t.Errorf("%s = %q no existe: %v", name, dir, err)
			continue
		}
		if !info.IsDir() {
			t.Errorf("%s = %q no es un directorio", name, dir)
		}
	}
}

func TestCheckFileExists(t *testing.T) {
	dir := t.TempDir()
	existing := filepath.Join(dir, "wallpaper.png")

	if err := os.WriteFile(existing, []byte("x"), 0o644); err != nil {
		t.Fatalf("no se pudo crear el fichero de prueba: %v", err)
	}

	app := NewApp()

	if !app.CheckFileExists(existing) {
		t.Errorf("CheckFileExists(%q) = false, se esperaba true", existing)
	}
	if app.CheckFileExists(filepath.Join(dir, "ausente.png")) {
		t.Error("CheckFileExists() = true para un fichero inexistente")
	}
}

func TestCheckBatteryDoesNotError(t *testing.T) {
	app := NewApp()

	// El valor depende del hardware del host; solo garantizamos que la consulta
	// sea segura (nunca panic) y coherente con /sys en Linux.
	hasBattery, err := app.CheckBattery()
	if err != nil {
		t.Fatalf("CheckBattery() error inesperado: %v", err)
	}

	if runtime.GOOS != "linux" {
		return
	}

	entries, err := os.ReadDir("/sys/class/power_supply")
	if err != nil {
		return // Sin acceso a sysfs: no hay nada que contrastar.
	}

	want := false
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), "BAT") {
			want = true
			break
		}
	}
	if hasBattery != want {
		t.Errorf("CheckBattery() = %v, sysfs indica %v", hasBattery, want)
	}
}

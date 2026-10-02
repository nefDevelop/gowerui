package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
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

// isolateHostWithoutGower limpia el entorno y verifica que no exista un gower
// real donde lo buscaría resolveGowerPath. Si lo hay, el escenario "no
// encontrado" no es reproducible y el test se omite en lugar de dar un falso
// positivo.
func isolateHostWithoutGower(t *testing.T) {
	t.Helper()

	dir := t.TempDir()
	t.Setenv("HOME", dir)
	t.Setenv("USERPROFILE", dir)
	t.Setenv("PATH", filepath.Join(dir, "empty-bin"))

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

func TestSetCustomGowerPath(t *testing.T) {
	// Un PATH válido con otro gower no debe ganar al path configurado.
	fakeGower(t, "exit 0")
	custom := fakeGowerAt(t, filepath.Join(t.TempDir(), "custom-gower"))

	app := NewApp()
	app.SetCustomGowerPath(custom)

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

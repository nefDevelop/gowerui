package main

import (
	"bytes"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// isolateLogs apunta el log a un directorio temporal y restaura el logger
// global al terminar, para que el resto de tests no escriban en el HOME real.
func isolateLogs(t *testing.T) string {
	t.Helper()

	// HOME se aísla también porque macOS no usa XDG para el log.
	isolateHome(t)

	dir := t.TempDir()
	t.Setenv("XDG_STATE_HOME", dir)
	t.Setenv("LOCALAPPDATA", dir)

	oldOutput := log.Writer()
	oldFlags := log.Flags()
	t.Cleanup(func() {
		log.SetOutput(oldOutput)
		log.SetFlags(oldFlags)
	})

	return dir
}

func TestDefaultLogPath(t *testing.T) {
	cases := []struct {
		name         string
		home         string
		goos         string
		xdgState     string
		localAppData string
		want         string
	}{
		{
			name:     "linux usa XDG_STATE_HOME",
			home:     "/home/u",
			goos:     "linux",
			xdgState: "/state",
			want:     "/state/gowerui/gowerui.log",
		},
		{
			name: "linux sin XDG cae en ~/.local/state",
			home: "/home/u",
			goos: "linux",
			want: "/home/u/.local/state/gowerui/gowerui.log",
		},
		{
			name:         "windows usa LOCALAPPDATA",
			home:         `C:\Users\u`,
			goos:         "windows",
			localAppData: `C:\Users\u\AppData\Local`,
			want:         filepath.Join(`C:\Users\u\AppData\Local`, "gowerui", "logs", "gowerui.log"),
		},
		{
			name: "windows sin LOCALAPPDATA",
			home: `C:\Users\u`,
			goos: "windows",
			want: filepath.Join(`C:\Users\u`, "AppData", "Local", "gowerui", "logs", "gowerui.log"),
		},
		{
			name: "darwin usa Library/Logs",
			home: "/Users/u",
			goos: "darwin",
			want: "/Users/u/Library/Logs/gowerui/gowerui.log",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := defaultLogPath(c.home, c.goos, c.xdgState, c.localAppData)
			if got != c.want {
				t.Errorf("defaultLogPath() = %q, se esperaba %q", got, c.want)
			}
		})
	}
}

func TestSetupLoggingWritesToFile(t *testing.T) {
	dir := isolateLogs(t)

	path, err := setupLogging()
	if err != nil {
		t.Fatalf("setupLogging() devolvió error: %v", err)
	}
	if !strings.HasPrefix(path, dir) && runtime.GOOS != "darwin" {
		t.Fatalf("el log se escribió fuera del directorio aislado: %s", path)
	}

	log.Print("marcador-de-prueba")

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("no se pudo leer el log: %v", err)
	}
	if !strings.Contains(string(data), "marcador-de-prueba") {
		t.Errorf("el log no contiene la línea escrita: %q", string(data))
	}

	assertPrivateLogMode(t, path)
}

// El log no debe ser legible por otras cuentas: puede contener rutas, ids y
// mensajes de error del usuario.
func assertPrivateLogMode(t *testing.T, path string) {
	t.Helper()

	if runtime.GOOS == "windows" {
		return // Los permisos POSIX no aplican.
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("no se pudo inspeccionar el log: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Errorf("permisos del log = %#o, se esperaba 0600", perm)
	}
}

// Abrir un log ya existente no cambia su modo: setupLogging debe corregir el
// 0644 que dejaban las versiones anteriores.
func TestSetupLoggingTightensExistingLog(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("los permisos POSIX no aplican en Windows")
	}

	isolateLogs(t)

	path, err := logPath()
	if err != nil {
		t.Fatalf("logPath() devolvió error: %v", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("no se pudo crear el directorio del log: %v", err)
	}
	if err := os.WriteFile(path, []byte("viejo\n"), 0o644); err != nil {
		t.Fatalf("no se pudo preparar el log: %v", err)
	}
	if err := os.Chmod(path, 0o644); err != nil {
		t.Fatalf("no se pudieron ajustar los permisos: %v", err)
	}

	if _, err := setupLogging(); err != nil {
		t.Fatalf("setupLogging() devolvió error: %v", err)
	}

	assertPrivateLogMode(t, path)
}

func TestRotateLogRenamesWhenFull(t *testing.T) {
	path := filepath.Join(t.TempDir(), logFileName)

	filler := bytes.Repeat([]byte("x"), logMaxBytes+1)
	if err := os.WriteFile(path, filler, 0o644); err != nil {
		t.Fatalf("no se pudo preparar el log: %v", err)
	}

	rotateLog(path)

	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Errorf("el log original sigue existiendo tras rotar")
	}
	info, err := os.Stat(path + ".1")
	if err != nil {
		t.Fatalf("no se creó la generación rotada: %v", err)
	}
	if info.Size() != int64(len(filler)) {
		t.Errorf("la generación rotada tiene %d bytes, se esperaban %d", info.Size(), len(filler))
	}
}

func TestRotateLogKeepsSmallFiles(t *testing.T) {
	path := filepath.Join(t.TempDir(), logFileName)
	if err := os.WriteFile(path, []byte("corto"), 0o644); err != nil {
		t.Fatalf("no se pudo preparar el log: %v", err)
	}

	rotateLog(path)

	if _, err := os.Stat(path); err != nil {
		t.Errorf("el log pequeño no debería rotarse: %v", err)
	}
	if _, err := os.Stat(path + ".1"); !os.IsNotExist(err) {
		t.Errorf("no debería existir una generación rotada para un log pequeño")
	}
}

func TestVersionsMatch(t *testing.T) {
	cases := []struct {
		name     string
		actual   string
		expected string
		want     bool
	}{
		{"misma versión con prefijo", "gower v0.1.0", "v0.1.0", true},
		{"sin prefijo v", "0.1.0", "v0.1.0", true},
		{"pre-release compatible", "gower version 0.1.0-alpha", "v0.1.0", true},
		{"versión distinta", "gower v0.2.0", "v0.1.0", false},
		{"sin versión reconocible no bloquea", "gower (devel)", "v0.1.0", true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := versionsMatch(c.actual, c.expected); got != c.want {
				t.Errorf("versionsMatch(%q, %q) = %v, se esperaba %v", c.actual, c.expected, got, c.want)
			}
		})
	}
}

func TestHandleCLIVersion(t *testing.T) {
	var out bytes.Buffer

	handled, code := handleCLI([]string{"--version"}, &out)
	if !handled {
		t.Fatal("--version debería haberse atendido")
	}
	if code != 0 {
		t.Errorf("código de salida = %d, se esperaba 0", code)
	}
	if !strings.Contains(out.String(), version) {
		t.Errorf("la salida no incluye la versión %q: %q", version, out.String())
	}
}

func TestHandleCLIHelp(t *testing.T) {
	var out bytes.Buffer

	handled, code := handleCLI([]string{"--help"}, &out)
	if !handled || code != 0 {
		t.Fatalf("--help devolvió handled=%v code=%d", handled, code)
	}
	for _, want := range []string{"--doctor", "--version", "gowerui"} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("la ayuda no menciona %q", want)
		}
	}
}

func TestHandleCLIIgnoresUnknownArguments(t *testing.T) {
	var out bytes.Buffer

	// El sistema operativo puede pasar argumentos propios: no deben
	// interpretarse como modos de la CLI.
	handled, _ := handleCLI([]string{"-psn_0_12345"}, &out)
	if handled {
		t.Errorf("un argumento desconocido no debería atenderse")
	}
}

func TestHandleCLIDoctorIsHandled(t *testing.T) {
	isolateHome(t)
	isolateLogs(t)
	t.Setenv("PATH", filepath.Join(t.TempDir(), "empty-bin"))

	handled, _ := handleCLI([]string{"--doctor"}, &bytes.Buffer{})
	if !handled {
		t.Error("--doctor debería haberse atendido")
	}
}

func TestRunDoctorReportsHealthySidecar(t *testing.T) {
	pin := sidecarPin()
	if pin == "" {
		t.Fatal("el pin embebido (.gower-version) está vacío")
	}

	isolateHome(t)
	isolateLogs(t)
	fakeGower(t, "echo 'gower "+pin+"'\n")

	var out bytes.Buffer
	code := runDoctor(&out)

	if code != 0 {
		t.Fatalf("runDoctor() = %d, se esperaba 0. Salida:\n%s", code, out.String())
	}
	for _, want := range []string{"sidecar pin", pin, "result: OK", "settings"} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("la salida del doctor no menciona %q:\n%s", want, out.String())
		}
	}
}

func TestRunDoctorFailsWithoutGower(t *testing.T) {
	isolateHostWithoutGower(t)
	isolateLogs(t)

	var out bytes.Buffer
	code := runDoctor(&out)

	if code != 1 {
		t.Fatalf("runDoctor() = %d, se esperaba 1. Salida:\n%s", code, out.String())
	}
	if !strings.Contains(out.String(), "problem:") {
		t.Errorf("la salida no explica el problema:\n%s", out.String())
	}
	if !strings.Contains(out.String(), "result: FAIL") {
		t.Errorf("la salida no resume el fallo:\n%s", out.String())
	}
}

func TestRunDoctorFlagsVersionMismatch(t *testing.T) {
	isolateHome(t)
	isolateLogs(t)
	fakeGower(t, "echo 'gower v999.999.999'\n")

	var out bytes.Buffer
	code := runDoctor(&out)

	if code != 1 {
		t.Fatalf("runDoctor() = %d, se esperaba 1 para un sidecar distinto. Salida:\n%s", code, out.String())
	}
	if !strings.Contains(out.String(), "v999.999.999") {
		t.Errorf("la salida no muestra la versión encontrada:\n%s", out.String())
	}
}

func TestRunDoctorFailsWhenSidecarCannotRun(t *testing.T) {
	isolateHome(t)
	isolateLogs(t)

	// Un fichero con shebang roto es ejecutable para LookPath pero exec falla,
	// que es lo que le pasa a un sidecar empaquetado para otra libc.
	path := fakeGowerAt(t, filepath.Join(t.TempDir(), gowerBinaryName()))
	if err := os.WriteFile(path, []byte("#!/nonexistent/interpreter\n"), 0o755); err != nil {
		t.Fatalf("no se pudo escribir el sidecar roto: %v", err)
	}
	t.Setenv("PATH", filepath.Dir(path))

	var out bytes.Buffer
	code := runDoctor(&out)

	if code != 1 {
		t.Fatalf("runDoctor() = %d, se esperaba 1. Salida:\n%s", code, out.String())
	}
	if !strings.Contains(out.String(), "cannot run the sidecar") {
		t.Errorf("la salida no explica que el sidecar no se puede ejecutar:\n%s", out.String())
	}
}

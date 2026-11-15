package main

import (
	"context"
	_ "embed"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

// La versión del sidecar que espera este build viaja embebida para que
// `--doctor` pueda compararla con el binario que hay junto a la app. Es el
// mismo pin que usa el workflow de release, así que no hay una segunda fuente
// de verdad: se lee del fichero, no se copia a mano.
//
//go:embed .gower-version
var sidecarPinFile string

const cliUsage = `gowerui - GUI for the gower wallpaper manager

Usage:
  gowerui              launch the desktop application
  gowerui --version    print the application version
  gowerui --doctor     check the sidecar, config and log paths, then exit

--doctor exits with 0 only when the sidecar can be used, so a packaged bundle
can run it as a smoke test without a display.
`

// doctor acumula el resultado de las comprobaciones. Cada problema se imprime
// junto al dato que lo provocó y al final se decide el código de salida.
type doctor struct {
	out      io.Writer
	problems int
}

func (d *doctor) field(label, value string) {
	fmt.Fprintf(d.out, "  %-16s %s\n", label+":", value)
}

func (d *doctor) problem(format string, args ...interface{}) {
	d.problems++
	fmt.Fprintf(d.out, "  %-16s %s\n", "problem:", fmt.Sprintf(format, args...))
}

func (d *doctor) result() int {
	fmt.Fprintln(d.out)
	if d.problems == 0 {
		fmt.Fprintln(d.out, "result: OK")
		return 0
	}

	plural := ""
	if d.problems != 1 {
		plural = "s"
	}
	fmt.Fprintf(d.out, "result: FAIL (%d problem%s)\n", d.problems, plural)
	return 1
}

// runDoctor comprueba todo lo que puede impedir que la app funcione: el
// sidecar resoluble, la versión que espera el build, y que la config y el log
// se puedan escribir. Devuelve el código de salida del proceso.
func runDoctor(w io.Writer) int {
	d := &doctor{out: w}

	fmt.Fprintf(w, "gowerui %s (%s/%s)\n\n", version, runtime.GOOS, runtime.GOARCH)

	pin := sidecarPin()
	if pin == "" {
		d.problem("the embedded sidecar pin (.gower-version) is empty")
	} else {
		d.field("sidecar pin", pin)
	}

	// setupLogging prueba de paso que el fichero se puede abrir y crear el
	// directorio si hace falta.
	if path, err := setupLogging(); err != nil {
		d.problem("cannot write the log file %s: %v", path, err)
	} else {
		d.field("log", path)
	}

	app := NewApp()
	if err := app.loadSettings(); err != nil {
		d.problem("cannot read the GUI settings: %v", err)
	}

	if settingsPath, err := app.settingsPath(); err != nil {
		d.problem("cannot prepare the config directory: %v", err)
	} else if err := probeWritable(filepath.Dir(settingsPath)); err != nil {
		d.problem("the config directory %s is not writable: %v", filepath.Dir(settingsPath), err)
	} else {
		d.field("settings", settingsPath+" (writable)")
	}

	if app.customPath != "" {
		d.field("configured", app.customPath)
	}

	gowerPath, err := app.resolveGowerPath()
	if err != nil {
		d.problem("%v", err)
		return d.result()
	}
	d.field("gower", gowerPath)

	actual, err := sidecarVersion(gowerPath)
	if err != nil {
		// Si el binario no se puede ejecutar, la app está rota aunque exista:
		// un sidecar compilado para otra libc falla exactamente aquí.
		d.problem("cannot run the sidecar: %v", err)
	} else {
		d.field("gower version", actual)
		if pin != "" && !versionsMatch(actual, pin) {
			d.problem("the sidecar reports %s but this build expects %s", actual, pin)
		}
	}

	return d.result()
}

// probeWritable comprueba que se puede crear y borrar un fichero en dir. Un
// Stat no basta: el directorio puede existir y ser de solo lectura.
func probeWritable(dir string) error {
	file, err := os.CreateTemp(dir, ".gowerui-doctor-*")
	if err != nil {
		return err
	}

	name := file.Name()
	file.Close()

	return os.Remove(name)
}

// sidecarVersion ejecuta `gower --version` con un límite de tiempo: un binario
// corrupto o colgado no debe dejar el diagnóstico pendiente para siempre.
func sidecarVersion(gowerPath string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	output, err := exec.CommandContext(ctx, gowerPath, "--version").CombinedOutput()
	text := strings.TrimSpace(string(output))
	if i := strings.IndexByte(text, '\n'); i >= 0 {
		text = strings.TrimSpace(text[:i])
	}

	if err != nil {
		if text == "" {
			return "", err
		}
		return "", fmt.Errorf("%v: %s", err, text)
	}

	if text == "" {
		return "", fmt.Errorf("no output")
	}

	return text, nil
}

var versionPattern = regexp.MustCompile(`(?i)v?(\d+\.\d+\.\d+)`)

// versionsMatch compara por el núcleo semántico e ignora sufijos como
// `-alpha`. Se acepta también que una sea prefijo de la otra para no fallar con
// pre-releases: el objetivo es detectar un sidecar claramente distinto, no
// validar un versionado concreto.
func versionsMatch(actual, expected string) bool {
	a, b := normalizeVersion(actual), normalizeVersion(expected)
	if a == "" || b == "" {
		return true
	}

	return a == b || strings.HasPrefix(a, b) || strings.HasPrefix(b, a)
}

func normalizeVersion(text string) string {
	if match := versionPattern.FindStringSubmatch(text); match != nil {
		return match[1]
	}
	return ""
}

// sidecarPin devuelve el tag del sidecar embebido en el binario.
func sidecarPin() string {
	return strings.TrimSpace(sidecarPinFile)
}

// handleCLI atiende los modos sin interfaz. Devuelve handled=false cuando hay
// que arrancar la GUI, para no interpretar como propios los argumentos que
// pueda pasar el sistema operativo.
func handleCLI(args []string, w io.Writer) (handled bool, exitCode int) {
	if len(args) == 0 {
		return false, 0
	}

	switch args[0] {
	case "-v", "--version", "version":
		fmt.Fprintf(w, "gowerui %s\n", version)
		return true, 0
	case "--doctor", "doctor":
		return true, runDoctor(w)
	case "-h", "--help", "help":
		fmt.Fprint(w, cliUsage)
		return true, 0
	}

	return false, 0
}

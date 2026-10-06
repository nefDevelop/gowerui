package main

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// gowerContract refleja las claves del contrato que gower publica en
// contract/gower-contract.json. Aquí solo se lee para comprobar que sigue
// declarando lo que este frontend consume.
type gowerContract struct {
	ContractVersion int `json:"contract_version"`
	WallpaperItem   struct {
		Required []string `json:"required"`
		Optional []string `json:"optional"`
	} `json:"wallpaper_item"`
}

// contractKeysFrontendReads son las claves de un item de wallpaper que usa la
// UI (mapThumbnails y los componentes de rejilla). Si gower deja de declararlas
// en el contrato, el parseo del frontend se rompe en silencio.
var contractKeysFrontendReads = []string{"id", "url", "source", "thumbnail", "path", "ext"}

// TestGowerContractFile verifica que el contrato descargado del tag pineado
// sigue declarando las claves que consume la UI. Se omite si GOWER_CONTRACT no
// está definido (una ejecución local sin red).
func TestGowerContractFile(t *testing.T) {
	path := os.Getenv("GOWER_CONTRACT")
	if path == "" {
		t.Skip("GOWER_CONTRACT no definido: verificación del contrato solo cuando se descarga")
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("no se pudo leer el contrato %s: %v", path, err)
	}

	var c gowerContract
	if err := json.Unmarshal(data, &c); err != nil {
		t.Fatalf("contrato inválido %s: %v", path, err)
	}

	declared := make(map[string]bool)
	for _, k := range append(append([]string{}, c.WallpaperItem.Required...), c.WallpaperItem.Optional...) {
		declared[k] = true
	}
	for _, k := range contractKeysFrontendReads {
		if !declared[k] {
			t.Errorf("el contrato v%d ya no declara la clave %q que consume la UI", c.ContractVersion, k)
		}
	}
}

// TestGowerContractCommands ejecuta el binario pineado (GOWER_BIN) y comprueba
// que las salidas --json conservan las claves del contrato que se pueden
// ejercitar sin escritorio. Se omite si GOWER_BIN no está definido.
func TestGowerContractCommands(t *testing.T) {
	bin := os.Getenv("GOWER_BIN")
	if bin == "" {
		t.Skip("GOWER_BIN no definido: ejecuta el binario pineado solo en CI")
	}

	isolateContractHome(t)

	runContractCommand(t, bin, "config", "init")

	t.Run("version", func(t *testing.T) {
		out := runContractCommand(t, bin, "version")
		pin := readPinnedTag()
		if pin != "" && !strings.Contains(out, pin) {
			t.Errorf("'gower version' no menciona el pin %q:\n%s", pin, out)
		}
	})

	t.Run("status", func(t *testing.T) {
		obj := toObject(t, runContractJSON(t, bin, "status", "--json"))
		for _, k := range []string{"daemon", "providers", "wallpaper"} {
			if _, ok := obj[k]; !ok {
				t.Errorf("status --json: falta la clave %q", k)
			}
		}
		if daemon, ok := obj["daemon"].(map[string]any); ok {
			if _, ok := daemon["running"]; !ok {
				t.Errorf("status --json: falta daemon.running")
			}
		}
	})

	t.Run("config", func(t *testing.T) {
		obj := toObject(t, runContractJSON(t, bin, "config", "show", "--json"))
		for _, k := range []string{"providers", "behavior", "paths"} {
			if _, ok := obj[k]; !ok {
				t.Errorf("config show --json: falta la clave %q", k)
			}
		}
	})

	t.Run("colors", func(t *testing.T) {
		for _, args := range [][]string{
			{"feed", "get", "colors", "--json"},
			{"favorites", "get", "colors", "--json"},
		} {
			if _, ok := runContractJSON(t, bin, args...).([]any); !ok {
				t.Errorf("%v: se esperaba un array", args)
			}
		}
	})

	t.Run("monitors", func(t *testing.T) {
		// En un runner sin escritorio no hay monitores y la clave puede faltar:
		// solo se valida cuando están presentes.
		obj := toObject(t, runContractJSON(t, bin, "status", "--monitors", "--json"))
		monitors, ok := obj["monitors"].([]any)
		if !ok {
			t.Skip("sin monitores detectados en este entorno")
		}
		for _, m := range monitors {
			item, ok := m.(map[string]any)
			if !ok {
				t.Fatalf("monitor no es objeto: %v", m)
			}
			for _, k := range []string{"ID", "Name", "Primary"} {
				if _, ok := item[k]; !ok {
					t.Errorf("monitor: falta la clave %q", k)
				}
			}
		}
	})
}

// isolateContractHome apunta HOME/XDG a un temporal para que las pruebas no
// lean ni escriban la config real del usuario.
func isolateContractHome(t *testing.T) {
	t.Helper()

	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
}

// runContractCommand ejecuta gower con el entorno aislado y devuelve stdout y
// stderr combinados: gower escribe el JSON en stderr y la app real usa
// CombinedOutput por el mismo motivo.
func runContractCommand(t *testing.T, bin string, args ...string) string {
	t.Helper()

	cmd := exec.Command(bin, args...)
	cmd.Env = os.Environ()
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("gower %s falló: %v\n%s", strings.Join(args, " "), err, out)
	}
	return string(out)
}

// runContractJSON extrae y parsea el primer JSON del resultado combinado.
func runContractJSON(t *testing.T, bin string, args ...string) any {
	t.Helper()

	out := runContractCommand(t, bin, args...)
	idx := strings.IndexAny(out, "{[")
	if idx < 0 {
		t.Fatalf("gower %s: no hay JSON en la salida:\n%s", strings.Join(args, " "), out)
	}

	dec := json.NewDecoder(bytes.NewReader([]byte(out[idx:])))
	var v any
	if err := dec.Decode(&v); err != nil {
		t.Fatalf("gower %s: JSON inválido: %v\n%s", strings.Join(args, " "), err, out)
	}
	return v
}

// toObject exige que el valor sea un objeto JSON.
func toObject(t *testing.T, v any) map[string]any {
	t.Helper()

	obj, ok := v.(map[string]any)
	if !ok {
		t.Fatalf("se esperaba un objeto JSON, llegó %T", v)
	}
	return obj
}

// readPinnedTag lee .gower-version; devuelve cadena vacía si no existe.
func readPinnedTag() string {
	data, err := os.ReadFile(".gower-version")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCanServeLocalAsset(t *testing.T) {
	dir := t.TempDir()

	writeFile := func(name string) string {
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
			t.Fatalf("no se pudo crear %s: %v", name, err)
		}
		return path
	}

	image := writeFile("wall.PNG")
	document := writeFile("secret.txt")
	extensionless := writeFile("id_rsa")
	subdir := filepath.Join(dir, "album.png")
	if err := os.Mkdir(subdir, 0o755); err != nil {
		t.Fatalf("no se pudo crear el directorio: %v", err)
	}

	cases := []struct {
		name string
		path string
		want bool
	}{
		{"imagen con extensión en mayúsculas", image, true},
		{"documento arbitrario", document, false},
		{"fichero sin extensión", extensionless, false},
		{"directorio aunque se llame .png", subdir, false},
		{"ruta inexistente", filepath.Join(dir, "missing.png"), false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := canServeLocalAsset(c.path); got != c.want {
				t.Errorf("canServeLocalAsset(%q) = %v, se esperaba %v", c.path, got, c.want)
			}
		})
	}
}

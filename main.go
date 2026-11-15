package main

import (
	"context"
	"embed"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"fyne.io/systray"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/build
var assets embed.FS

//go:embed frontend/static/favicon.png
var icon []byte

func main() {
	// Los modos sin interfaz (--version, --doctor, --help) se atienden antes de
	// tocar GTK: así funcionan en una terminal, en CI y sin display.
	if handled, code := handleCLI(os.Args[1:], os.Stdout); handled {
		os.Exit(code)
	}

	// A partir de aquí se puede lanzar la GUI: el log va a fichero además de a
	// stdout, porque lanzada desde el menú nadie ve el stdout.
	if path, err := setupLogging(); err != nil {
		fmt.Printf("[BACKEND] File logging disabled (%s): %v\n", path, err)
	}

	log.Printf("[BACKEND] gowerui %s starting (%s/%s)", version, runtime.GOOS, runtime.GOARCH)

	// Hack for Wayland/Waybar compatibility
	if runtime.GOOS == "linux" {
		if os.Getenv("XDG_CURRENT_DESKTOP") == "" {
			os.Setenv("XDG_CURRENT_DESKTOP", "Unity")
		}
	}

	// Create an instance of the app structure
	app := NewApp()

	// Create an empty menu to satisfy the OS/Wayland requirement for tray icons
	// without showing any visible menu items.
	AppMenu := menu.NewMenu()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "gowerui",
		Width:  440,
		Height: 750,
		AssetServer: &assetserver.Options{
			Assets: assets,
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Handle local asset requests (thumbnails)
				if strings.HasPrefix(r.URL.Path, "/local-asset/") {
					// 1. Get the raw path after the prefix
					rawPath := strings.TrimPrefix(r.URL.Path, "/local-asset/")

					// 2. Remove any leading slashes that might cause // (double slash)
					for strings.HasPrefix(rawPath, "/") {
						rawPath = strings.TrimPrefix(rawPath, "/")
					}

					// 3. Unescape URL
					decodedPath, err := url.PathUnescape(rawPath)
					if err != nil {
						http.Error(w, "Invalid path encoding", http.StatusBadRequest)
						return
					}

					// 4. Ensure absolute path on Linux
					if runtime.GOOS != "windows" && !strings.HasPrefix(decodedPath, "/") {
						decodedPath = "/" + decodedPath
					}

					// 5. Clean path
					decodedPath = filepath.Clean(decodedPath)

					if _, err := os.Stat(decodedPath); err == nil {
						http.ServeFile(w, r, decodedPath)
						return
					}
					log.Printf("[ASSETS] Not found: %s", decodedPath)
					http.Error(w, "File not found", http.StatusNotFound)
					return
				}
				http.NotFound(w, r)
			}),
		},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)

			// systray.Run bloquea y comparte GTK con Wails: se lanza en su
			// propia goroutine y con margen para que Wails inicialice su loop.
			go func() {
				runtime.Gosched()
				startTray(ctx, app.tray, icon)
			}()
		},
		OnBeforeClose: func(ctx context.Context) bool {
			// Ocultar solo es recuperable si el tray está vivo. Si no lo está,
			// dejar que Wails cierre: es preferible salir a quedar sin ventana.
			if app.tray.shouldHideOnClose() {
				wailsRuntime.WindowHide(ctx)
				return true
			}

			app.tray.markQuitting()
			return false
		},
		OnShutdown: func(ctx context.Context) {
			app.tray.markQuitting()
			if app.tray.hasStarted() {
				systray.Quit()
			}
		},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId: "gowerui",
			// Relanzar la app es la salida de emergencia cuando la ventana está
			// oculta: muestra la instancia existente en vez de abrir otra.
			OnSecondInstanceLaunch: func(options.SecondInstanceData) {
				wailsRuntime.WindowShow(app.ctx)
				wailsRuntime.WindowUnminimise(app.ctx)
			},
		},
		Bind: []interface{}{
			app,
		},
		Menu:        AppMenu,
		Frameless:   true,
		AlwaysOnTop: true,
		StartHidden: false,
		Windows: &windows.Options{
			WebviewIsTransparent:              true,
			WindowIsTranslucent:               true,
			BackdropType:                      windows.Acrylic,
			DisableWindowIcon:                 false,
			IsZoomControlEnabled:              false,
			ZoomFactor:                        1.0,
			DisableFramelessWindowDecorations: true,
		},
		Linux: &linux.Options{
			WindowIsTranslucent: true,
		},
	})

	if err != nil {
		// Un fallo al arrancar Wails no puede terminar con código 0: el
		// lanzador del escritorio creería que la app se cerró bien.
		log.Printf("[BACKEND] Fatal: %v", err)
		os.Exit(1)
	}
}

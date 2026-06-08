package main

import (
	"embed"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/build
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create a custom menu
	AppMenu := menu.NewMenu()
	FileMenu := AppMenu.AddSubmenu("File")
	FileMenu.AddText("Quit", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		wailsRuntime.Quit(app.ctx)
	})

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
					fmt.Printf("[ASSETS] Not found: %s\n", decodedPath)
					http.Error(w, "File not found", http.StatusNotFound)
					return
				}
				http.NotFound(w, r)
			}),
		},
		OnStartup: app.startup,
		Bind: []interface{}{
			app,
		},
		Menu:              AppMenu,
		Frameless:         true,
		AlwaysOnTop:       true,
		StartHidden:       false,
		HideWindowOnClose: true,
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
		fmt.Println("Error:", err.Error())
	}
}

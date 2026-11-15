package main

import (
	"context"
	"log"
	"sync"

	"fyne.io/systray"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// trayState coordina el icono de bandeja con el ciclo de vida de la ventana.
//
// Ocultar la ventana al cerrar solo es seguro si queda un icono desde el que
// recuperarla. Si el escritorio no soporta StatusNotifier/AppIndicator (GNOME
// sin extensión, por ejemplo) el tray no se ve, y con HideWindowOnClose la app
// quedaba viva sin ventana y sin forma de volver. Por eso la decisión se toma
// en cada cierre, cuando ya se sabe si el tray llegó a arrancar.
type trayState struct {
	mu       sync.RWMutex
	started  bool
	ready    bool
	quitting bool
}

// markStarted indica que la goroutine del tray ya está en marcha, aunque el
// icono todavía no esté listo.
func (s *trayState) markStarted() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.started = true
}

func (s *trayState) hasStarted() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.started
}

// markReady se llama desde el callback onReady de systray, cuando el menú ya
// existe. A partir de aquí ocultar la ventana es recuperable.
func (s *trayState) markReady() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.started = true
	s.ready = true
}

// markExited invalida el tray: una ventana que se oculte a partir de ahora
// quedaría inaccesible.
func (s *trayState) markExited() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ready = false
}

// markQuitting distingue un cierre pedido por el usuario de la caída del tray.
func (s *trayState) markQuitting() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.quitting = true
}

func (s *trayState) quittingRequested() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.quitting
}

// shouldHideOnClose responde a la única pregunta que importa: ¿hay un icono
// vivo desde el que reabrir la ventana?
func (s *trayState) shouldHideOnClose() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.ready && !s.quitting
}

// startTray arranca el icono y lo mantiene sincronizado con la ventana.
// Bloquea hasta que systray termina, por eso se lanza en una goroutine.
func startTray(ctx context.Context, state *trayState, icon []byte) {
	// systray vive en una goroutine propia: un panic aquí mataría el proceso
	// sin dejar rastro en el log.
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[TRAY] Panic: %v", r)
		}

		state.markExited()

		// Si el tray se cae con la ventana oculta, el usuario no tendría
		// ninguna forma de recuperarla: se muestra antes de seguir.
		if !state.quittingRequested() {
			log.Println("[TRAY] Tray no longer available, showing the window")
			wailsRuntime.WindowShow(ctx)
		}
	}()

	state.markStarted()
	log.Println("[TRAY] Starting system tray...")

	systray.Run(func() {
		state.markReady()

		systray.SetIcon(icon)
		systray.SetTitle("gowerui")
		systray.SetTooltip("Gower Wallpaper Manager")

		mShow := systray.AddMenuItem("Mostrar", "Mostrar la ventana")
		systray.AddSeparator()
		mQuit := systray.AddMenuItem("Salir", "Cerrar aplicación")

		go func() {
			for {
				select {
				case <-mShow.ClickedCh:
					wailsRuntime.WindowShow(ctx)
				case <-mQuit.ClickedCh:
					// Marcar el cierre antes de pedirlo: OnBeforeClose
					// consulta el estado y, si no, volvería a ocultar.
					state.markQuitting()
					wailsRuntime.Quit(ctx)
					return
				}
			}
		}()

		log.Println("[TRAY] System tray ready")
	}, func() {
		log.Println("[TRAY] System tray stopped")
	})
}

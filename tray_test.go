package main

import "testing"

func TestNewAppHasTrayState(t *testing.T) {
	if NewApp().tray == nil {
		t.Fatal("NewApp() debe inicializar tray: CloseApp y OnBeforeClose lo consultan")
	}
}

func TestTrayStateDoesNotHideBeforeReady(t *testing.T) {
	state := &trayState{}

	if state.shouldHideOnClose() {
		t.Error("sin tray listo, cerrar debe cerrar la app, no ocultarla")
	}
	if state.hasStarted() {
		t.Error("el tray no se ha arrancado todavía")
	}
}

// Aunque systray arranque, hasta que no confirma onReady no hay icono desde el
// que recuperar la ventana.
func TestTrayStateHidesOnlyWhenReady(t *testing.T) {
	state := &trayState{}
	state.markStarted()

	if state.shouldHideOnClose() {
		t.Error("arrancado pero no listo: no se debe ocultar")
	}
	if !state.hasStarted() {
		t.Error("markStarted debería marcar el arranque")
	}

	state.markReady()

	if !state.shouldHideOnClose() {
		t.Error("con el tray listo, ocultar la ventana es recuperable")
	}
}

func TestTrayStateStopsHidingAfterExit(t *testing.T) {
	state := &trayState{}
	state.markReady()
	state.markExited()

	if state.shouldHideOnClose() {
		t.Error("un tray que ya terminó no puede recuperar la ventana")
	}
}

func TestTrayStateQuittingWins(t *testing.T) {
	state := &trayState{}
	state.markReady()
	state.markQuitting()

	if !state.quittingRequested() {
		t.Error("markQuitting no quedó registrado")
	}
	// Si el usuario pidió salir, no se puede bloquear el cierre ocultando la
	// ventana.
	if state.shouldHideOnClose() {
		t.Error("al salir, cerrar no debe ocultar la ventana")
	}
}

// markExited y markQuitting son idempotentes: onExit, el defer y OnShutdown
// pueden coincidir.
func TestTrayStateIsIdempotent(t *testing.T) {
	state := &trayState{}
	state.markReady()
	state.markExited()
	state.markExited()
	state.markQuitting()
	state.markQuitting()

	if state.shouldHideOnClose() || !state.quittingRequested() {
		t.Error("las transiciones repetidas no deben alterar el estado final")
	}
}

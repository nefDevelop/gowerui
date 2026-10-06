# Roadmap del Proyecto gowerGUI

Este documento describe los pasos necesarios y las características planificadas para el desarrollo futuro de gowerGUI.

## ✅ Fase 1: Migración a Wails (Completado)
- [x] Migrar el backend de Rust/Tauri a Go/Wails.
- [x] Implementar bindings para ejecución de comandos, gestión de archivos y estado de batería.
- [x] Adaptar el frontend (SvelteKit) para comunicarse con Wails.
- [x] Limpiar dependencias y archivos de Tauri.

## 🛠 Fase 2: Robustez y Funcionalidad (Completado)
- [x] **Manejo de rutas dinámico**: Buscar `gower` en el `$PATH` o usar configuración manual.
- [x] **Soporte de Batería**: Implementar chequeo para Linux y Windows en Go.
- [x] **Manejo de Errores**: Feedback visual en la UI cuando el backend falla.
- [x] **Internacionalización (i18n)**: Soporte completo para múltiples idiomas.
- [x] **Temas**: Soporte para temas claro/oscuro sincronizados con el sistema.

## ✅ Fase 3: Calidad e Infraestructura (Completado)
- [x] **Orquestador de tests**: `make test`, `make test-unit`, `make test-integration`, `make check`.
- [x] **Tests unitarios del backend**: `app_test.go` (resolución del sidecar, ejecución de comandos, contexto de la app).
- [x] **Tests unitarios del frontend**: Vitest + jsdom sobre `api.js` y los stores `theme`, `i18n`, `notifications`.
- [x] **Lint y typecheck en el pipeline**: `gofmt`, `go vet`, `svelte-check`.
- [x] **CI/CD**: Workflow migrado de Tauri a Wails, con job `test` y job `build-release` para Linux y Windows.
- [x] **Documentación**: `DOCUMENTATION.md` (arquitectura y referencia técnica) y `AGENTS.md` (convenciones).

## 🐛 Fase 4: Correcciones (Completado)
- [x] **Sidecar portable localizable**: `lookupGowerPath` buscaba solo en Ajustes, `$PATH` y rutas de instalación, **nunca junto al ejecutable**. El bundle portable de las releases no encontraba su motor y la app arrancaba con *"gower executable not found"*. Ahora busca `gower`/`gower.exe` en el directorio del binario y en `bin/`, con prioridad sobre el `$PATH`.
- [x] **Inyección de comandos**: `RunGowerCommand` concatenaba los argumentos en un `sh -c` para `set` y `daemon`. Como esos args incluyen ids de proveedores remotos y rutas del disco, cualquier metacaracter ejecutaba comandos arbitrarios. Se ejecuta siempre con `exec.Command`.
- [x] **El ajuste de la ruta de gower existía**: `SetCustomGowerPath` y `PickFile` eran bindings muertos, con cero referencias en el frontend, y el path vivía solo en memoria. Ahora hay UI en Ajustes y se persiste en `~/.config/gowerui/settings.json`.
- [x] **Toasts que nunca se eliminaban**: `add` no devolvía nada, así que el flujo de descarga pasaba `undefined` como `timeout` y los toasts se acumulaban para siempre. `add` devuelve el id y hay `update(id, ...)` con rearme del temporizador.
- [x] **Validación de la ruta de Ajustes**: una ruta guardada que ya no existe se ignora en vez de devolver un path inválido; el error final la menciona para que sea diagnosticable.
- [x] **Error accionable**: el mensaje de "no encontrado" dice dónde se buscó y cómo resolverlo.
- [x] **`extractJson` robusto**: con salida tipo `[DEBUG] {...}` la función elegía la rama de array, no encontraba cierre y devolvía el texto crudo. Ahora escanea por balanceo, respeta cadenas y escapes, y prueba cada candidato en orden de aparición.
- [x] **Guard de `args` vacío**: `RunGowerCommand` hacía panic al leer `args[0]`; ahora devuelve un error descriptivo.
- [x] **Ruta background testeable**: `EventsEmit` con `ctx == nil` hacía panic e impedía cubrir el flujo de aplicar wallpaper. `App.emit` es inyectable y hay cinco tests nuevos.
- [x] **Versión real en la UI**: `SettingsPanel` pintaba "Version 1.1.0" con `wails.json` en 0.2.4. Se inyecta por `-ldflags` desde `wails.json` y la UI la pide con `GetAppVersion()`.
- [x] **Listener muerto**: `+layout.svelte` escuchaba `window-shown`, que Go nunca emite.
- [x] **Sidecar sin pin**: el workflow descargaba `releases/latest` y sobrescribía `sidecar-info.json` con lo que devolviese la API, así que la release no era reproducible ni reversible y el `v0.1.0` commiteado mentía. Ahora el tag vive en `.gower-version`, se descarga por URL de release y el JSON se genera desde el pin (`make sidecar-info`). `make verify-sidecar` comprueba que el pin existe.

## 🌟 Fase 5: Pendiente
- [x] **Verificación del contrato en gowerGUI**: `contract_test.go` descarga/usa el binario y el `gower-contract.json` del tag pineado, los ejecuta sobre un `HOME` aislado y valida las claves `--json`. Cableado en el job `test` del CI.
- [x] **Bump del pin automatizado**: gower dispara `repository_dispatch` al publicar tag y `bump-sidecar.yml` abre un PR que solo actualiza `.gower-version`.
- [ ] **Tests E2E**: Configurar `playwright.config.js` y escribir los primeros specs.
- [ ] **Tests de componentes Svelte**: Cubrir `WallpaperGrid`, `SearchPanel`, `SettingsPanel`, `ToastContainer`.
- [ ] **Internacionalizar los toasts y el tray**: ~15 mensajes en `+page.svelte` y el menú del tray (`main.go`) están en español fijo. La app se declara multi-idioma pero estas cadenas nunca se traducen.
- [ ] **Actualizaciones Automáticas**: Implementar un sistema de actualización para la aplicación.
- [ ] **Mejoras en el Tray**: Añadir más opciones rápidas al menú de la bandeja. De paso, el tray debería emitir `window-shown` para que el listener que se ha borrado tenga sentido si se recupera.
- [ ] **Soporte para más plataformas**: Validar y mejorar la experiencia en macOS y Windows.

## 📌 Deuda técnica conocida
- [ ] **`os.MkdirAll` con el error ignorado** en `GetAppContext`: la función sí devuelve `error`, pero descarta el de `MkdirAll` y devolvería rutas que no existen.
- [ ] **`OpenPath` sin `Wait()`**: deja procesos zombis acumulados.
- [ ] **`CheckBattery` en Windows usa `Get-WmiObject`**, obsoleto y ausente en Windows 11 recientes. `Get-CimInstance` es el sustituto.
- [ ] **`Sh -c` retirado sin prueba manual**: hay tests de regresión, pero conviene aplicar un wallpaper en Linux y arrancar el daemon antes de la próxima release.
- [ ] **Targets `docker-*` del `Makefile`**: son placeholders de la era Tauri y no están implementados.
- [ ] **`.devcontainer`**: la imagen de Wails está actualizada, pero no se ha validado un `build` completo dentro del contenedor.
- [ ] **Wails CLI local (v2.13.0) por delante de `go.mod` (v2.12.0)**: un `wails build` a pelo puede bumpear las dependencias sin avisar. Decidir si se sube a propósito o se pinea el CLI.

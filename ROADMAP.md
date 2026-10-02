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
- [x] **Validación de la ruta de Ajustes**: una ruta guardada que ya no existe se ignora en vez de devolver un path inválido; el error final la menciona para que sea diagnosticable.
- [x] **Error accionable**: el mensaje de "no encontrado" dice dónde se buscó y cómo resolverlo.
- [x] **`extractJson` robusto**: con salida tipo `[DEBUG] {...}` la función elegía la rama de array, no encontraba cierre y devolvía el texto crudo. Ahora escanea por balanceo, respeta cadenas y escapes, y prueba cada candidato en orden de aparición.
- [x] **Guard de `args` vacío**: `RunGowerCommand` hacía panic al leer `args[0]`; ahora devuelve un error descriptivo.

## 🌟 Fase 5: Pendiente
- [ ] **Tests E2E**: Configurar `playwright.config.js` y escribir los primeros specs.
- [ ] **Tests de componentes Svelte**: Cubrir `WallpaperGrid`, `SearchPanel`, `SettingsPanel`, `ToastContainer`.
- [ ] **Actualizaciones Automáticas**: Implementar un sistema de actualización para la aplicación.
- [ ] **Mejoras en el Tray**: Añadir más opciones rápidas al menú de la bandeja.
- [ ] **Soporte para más plataformas**: Validar y mejorar la experiencia en macOS y Windows.

## 📌 Deuda técnica conocida
- [ ] **El path `background=true` no es testeable unitariamente**: la goroutine llama a `wailsRuntime.EventsEmit` y hace panic si el contexto de Wails es `nil`. Requiere inyectar el contexto.
- [ ] **La ruta del sidecar no se persiste**: `SetCustomGowerPath` vive en memoria, así que el path elegido en Ajustes se pierde al reiniciar.
- [ ] **Targets `docker-*` del `Makefile`**: son placeholders de la era Tauri y no están implementados.
- [ ] **`.devcontainer`**: la imagen de Wails está actualizada, pero no se ha validado un `build` completo dentro del contenedor.

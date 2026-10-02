# AGENTS.md — gowerGUI

Instrucciones operativas para agentes que trabajen en este repositorio.
 complementan la guía global del desarrollador; si algo se contradice, manda
esta ficha porque conoce las particularidades del proyecto.

## Contexto

gowerUI es una **GUI de escritorio** (escritorio Linux/Windows) para
[nefDevelop/gower](https://github.com/nefDevelop/gower), un gestor de fondos de
pantalla. La app **no implementa lógica de wallpaper**: es una capa fina de
presentación que invoca el CLI `gower` como *sidecar* y traduce su salida JSON a
la interfaz SvelteKit.

## Stack (no assumption, verificado)

- **Backend**: Go + Wails v2 (`github.com/wailsapp/wails/v2`) + `fyne.io/systray`
- **Frontend**: SvelteKit 2 + Svelte 5 + Vite 6, sin framework de estilos
- **Tests**: `testing` de la stdlib de Go (sin testify) + Vitest 4 (jsdom)
- **Gestor de paquetes**: npm, siempre con `workdir=frontend/`

> No hay `package.json` en la raíz. Todo lo de Node vive en `frontend/`.

## Estructura

```
.
├── main.go                  # Arranque de Wails, ventana, tray, asset handler /local-asset
├── app.go                   # Bindings expuestos al frontend (App)
├── app_test.go              # Tests unitarios del backend
├── Makefile                 # Orquestador de build y tests
├── wails.json               # Config de Wails (nombre, versión, flags)
├── frontend/
│   ├── src/lib/api.js       # Fachada sobre window.go.main.App +extractJson
│   ├── src/lib/stores/      # Svelte stores: theme, i18n, notifications
│   ├── src/lib/components/  # Componentes Svelte de presentación
│   ├── src/routes/          # +page.svelte (pantalla principal), +layout
│   ├── src/test/setup.js    # Setup de Vitest (mock de localStorage y matchMedia)
│   └── src/lib/sidecar-info.json  # Versión del sidecar embebida en el build
└── .github/workflows/       # CI: job `test` + job `build-release`
```

**No hay capas Clean Architecture / DDD.** El proyecto es deliberadamente
plano (Presentación ↔ Bindings ↔ Sidecar). Aplica Clean Architecture solo si se
introduce una entidad de dominio real o una regla de negocio; no para un
cambio de UI, un fix puntual o configuración.

## Comandos

**Todo se orquesta con `make`.** No invocar `go test` o `vitest` a mano.

| Comando | Qué hace |
|---|---|
| `make test` | Suite completa: `test-unit` + `test-integration` |
| `make test-unit` | `go test ./...` + `npm run test:unit` (Vitest) |
| `make test-integration` | `go vet ./...` + `go build` (verifica el `//go:embed`) |
| `make lint` | `gofmt -l` + `go vet ./...` |
| `make typecheck` | `svelte-check` |
| `make check` | `lint` + `typecheck` + `test` |
| `make build` | `wails build -tags webkit2_41` |
| `make dev` | `wails dev` |

## Gotchas críticos

1. **`frontend/build` debe existir para que compile Go.** `main.go:24` hace
   `//go:embed all:frontend/build`. Sin el frontend compilado, `go build`,
   `go vet` y `go test` **fallan** con
   `pattern all:frontend/build: no matching files found`. Por eso los targets
   de Go dependen de `${FRONTEND_BUILD}` (`frontend/build/index.html`) en el
   `Makefile`. Si añades un target que compile Go, hereda esa dependencia.

2. **`-tags webkit2_41` es obligatorio** en Linux (WebKitGTK 4.1). Está en
   `wails.json` (`flags`) y en `WAILS_TAGS` del `Makefile`.

3. **NUNCA ejecutes `gower` por shell.** `RunGowerCommand` usa siempre
   `exec.Command(gowerPath, args...)`. Antes concatenaba los argumentos en un
   `sh -c` para los subcomandos `set` y `daemon`, y eso convertía cualquier
   metacaracter en código ejecutable: los argumentos incluyen ids que vienen
   de proveedores remotos (Reddit) y rutas del disco, controladas por terceros.
   El shell no aportaba nada porque `cmd.Env` ya hereda el entorno del proceso.
   La regresión está cubierta por
   `TestRunGowerCommandDoesNotInterpretShellMetacharacters`; si la rompes, ese
   test crea ficheros marcadores y falla.

4. **El sidecar NO va embebido.** Los únicos `//go:embed` son `frontend/build` y
   el favicon. `gower` viaja como **fichero hermano** del ejecutable en las
   releases portables. `lookupGowerPath` (app.go) busca, en orden: ruta de
   Ajustes → junto al ejecutable (`gower` o `bin/gower`) → `$PATH` → rutas de
   instalación habituales. Si cambias el layout del bundle, actualiza
   `lookupGowerPath` **y** el paso de empaquetado del workflow, que deben
   seguir coincidiendo.

5. **La config de la GUI vive en `~/.config/gowerui/settings.json`**, no en el
   config de `gower`: son cosas que `gower` no necesita saber. Se carga en
   `startup` antes de la primera llamada al CLI. Si añades un ajuste de la GUI,
   añádelo a `appSettings`, no a la config de gower. Un fichero ausente ni un
   fichero corrupto deben dejar la app funcionando: se ignoran con un log.

6. **Los diálogos nativos no pasan por el i18n del frontend.** Por eso
   `PickFile` y `PickDirectory` reciben el título como parámetro y el
   llamador lo pasa con `$t(...)`. Si añades un diálogo nuevo, mantén el patrón.

7. **Los tests aíslan el host.** `fakeGower` / `fakeGowerAt` crean scripts
   falsos; `isolateHostWithoutGower` vacía `PATH` y `HOME` y **omite** el test
   si detecta un `gower` real en el host, para no dar falsos positivos.
   `isolateHome` aísla solo el `HOME`, que es lo que necesitan los tests que
   tocan `settings.json`. Al añadir un caso "no encontrado", respétalos.

8. **El path en background no es testeable unitariamente.**
   `RunGowerCommand(..., background=true)` lanza una goroutine que llama
   `wailsRuntime.EventsEmit(a.ctx, ...)`, que hace panic con `ctx == nil`.
   Si necesitas cubrirlo, requiere inyectar el contexto de Wails.

9. **`extractJson` (`api.js`) escanea por balanceo, no por `lastIndexOf`.**
   El CLI antepone logs (`[DEBUG] ...`) a la salida, así que el primer `[` o
   `{` puede no abrir el JSON. La función prueba cada candidato en orden de
   aparición, respeta cadenas y escapes, y devuelve el primero que parsea. Si
   la tocas, conserva esos casos: hay tests de anidación, corchetes dentro de
   cadenas, escapes y JSON truncado.

10. **Los stores de Svelte son singletons a nivel de módulo.** El estado persiste
   entre tests del mismo fichero. Límpialos en `beforeEach`/`afterEach` (patrón
   `clearNotifications()`).

## Convenciones

- **Comentarios y docs en español**; nombres de código, commits y mensajes de
  error de UI en inglés.
- Frontend: 2 espacios de indentación. Go: `gofmt` (tabs).
- No añadir dependencias sin autorización explícita. Hoy no hay ninguna
  dependencia de runtime en el frontend (`dependencies: {}`); todo va en
  `devDependencies`.
- No tocar `frontend/wailsjs/` a mano: son bindings generados por
  `wails generate module`. Se regeneran con `wails dev`.

## Testing

- Backend: tabla de tests en `app_test.go`, `package main`, sin librerías
  externas. Usa `t.TempDir()`, `t.Setenv()` y helpers `fakeGower` /
  `isolateHostWithoutGower`.
- Frontend: Vitest con `jsdom`. El mock de `window.go.main.App` se hace por
  fichero; si repites el patrón, extráelo a `frontend/src/test/wails-mock.js`.
- **No ejecutes `make test` en cada iteración.** Ejecútalo al cerrar una
  funcionalidad, antes de commitear lógica de dominio o integración, o cuando
  se solicite.
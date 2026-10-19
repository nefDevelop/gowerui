# Documentación técnica — gowerGUI

Documento de referencia para mantener gowerGUI. Para el estado del proyecto y
el plan de trabajo, ver [`ROADMAP.md`](ROADMAP.md). Para las convenciones de
desarrollo, ver [`AGENTS.md`](AGENTS.md).

## 1. Arquitectura

gowerGUI es una aplicación de escritorio híbrida. El core de negocio **no está
aquí**: vive en el CLI [gower](https://github.com/nefDevelop/gower). gowerGUI es
una capa de presentación que:

1. Invoca `gower` como proceso hijo (*sidecar*).
2. Captura su salida (stdout + stderr) y la devuelve al frontend.
3. Traduce el JSON a la interfaz SvelteKit.

```
┌───────────────────────── Proceso gowerGUI ─────────────────────────┐
│                                                                     │
│  ┌──────────────────┐   bindings    ┌──────────────────┐            │
│  │  Frontend        │◄─────────────►│  Backend Go      │            │
│  │  SvelteKit       │  window.go.*  │  app.go (App)    │            │
│  │  (sandbox WebView)│               │  main.go (Wails) │            │
│  └──────────────────┘               └────────┬─────────┘            │
└──────────────────────────────────────────────┼──────────────────────-┘
                                               │ exec.Command
                                               ▼
                                    ┌──────────────────────┐
                                    │  CLI `gower`         │
                                    │  (sidecar, externo)  │
                                    └──────────────────────┘
```

No hay base de datos propia ni estado persistente en el backend: la
persistencia vive en el config de `gower` (`~/.config/gower`) y, en el
frontend, en `localStorage` (tema e idioma).

## 2. Capas

### 2.1 Backend (`app.go`, `main.go`)

Un único struct `App` concentration de los bindings. Todo lo expuesto al
frontend son sus métodos públicos; los no exportados son internos.

| Método | Propósito | Notas |
|---|---|---|
| `GetAppContext()` | Devuelve `cache_path`, `config_path`, `user_home` | Crea los directorios si no existen. En Windows usa `AppData`; en el resto `~/.config` y `~/.cache` |
| `RunGowerCommand(args, background)` | Ejecuta el CLI y devuelve stdout+stderr | Rechaza `args` vacío con error en vez de hacer panic. Se ejecuta **siempre** con `exec.Command`, nunca por shell: los args incluyen ids de proveedores remotos y rutas del disco |
| `GetGowerStatus()` | Dónde está `gower`, y si está disponible | Devuelve `resolved_path`, `configured_path`, `available` y `error`, que es lo que la UI necesita para explicar la situación |
| `SetCustomGowerPath(path)` | Fija y **persiste** la ruta del binario | Cadena vacía = volver al autodescubrimiento. Valida que exista y sea un fichero. Devuelve error si no se puede guardar |
| `CheckBattery()` | ¿Hay batería? | Linux: lee `/sys/class/power_supply`. Windows: PowerShell `Win32_Battery`. Otros: `true` |
| `CheckFileExists(path)` | Existencia de fichero | Nunca devuelve error, solo bool |
| `OpenPath(path)` | Abre fichero/URL con el handler del sistema | `xdg-open` / `open` / `explorer` |
| `PickFile(title)` | Diálogo para elegir el ejecutable `gower` | El título lo pasa el caller: los diálogos nativos no pasan por el i18n del frontend. Requiere contexto de Wails |
| `PickDirectory(title)` | Diálogo para elegir carpeta de wallpapers | Igual que `PickFile` con el título |
| `CloseApp()` | Oculta la ventana (no cierra la app) | Requiere contexto de Wails |

### 2.1.1 Configuración propia

La GUI guarda su configuración en `~/.config/gowerui/settings.json`, separada
del config de `gower` porque son cosas que `gower` no necesita saber:

```json
{
  "gower_path": "/opt/gower/bin/gower"
}
```

`gower_path` es la ruta elegida en Ajustes; vacía significa "descúbrelo solo".
Se carga en `startup` (antes de la primera llamada al CLI) y se escribe en cada
cambio.

Un `settings.json` ausente es el estado normal de una instalación nueva, no un
error. Uno corrupto se descarta con un log en vez de propagar: es preferible
quedarse sin ruta guardada que dejar la app sin motor.

### 2.2 Resolución del sidecar

`resolveGowerPath()` (no exportado) delega en `lookupGowerPath()`, que busca en
este orden de precedencia:

1. `App.customPath`, si el usuario configuró una ruta en Ajustes **y el fichero
   existe**. Si la ruta guardada ya no es válida, se ignora y se sigue
   buscando (el error final la menciona).
2. **Sidecar portable**: `gower` junto al ejecutable de la app, o en `bin/`
   debajo de él. Gana deliberadamente sobre el `PATH`: en un bundle portable la
   versión que acompaña al binario es la aprobada para esa release, mientras
   que el `PATH` puede apuntar a otra instalación.
3. `exec.LookPath("gower")` → el `$PATH`.
4. Rutas de instalación habituales: `~/go/bin/gower`, `~/.local/bin/gower`,
   `/usr/local/bin/gower`, `/usr/bin/gower`.

En los pasos 2 a 4 solo se acepta un **fichero regular**: un directorio llamado
`gower` se descarta en lugar de fallar en tiempo de ejecución.

Si ninguna existe devuelve un error que dice dónde se ha buscado y cómo
resolverlo (*"install it or select it in Settings"*), no un "not found" seco.

> **Requisito de empaquetado:** los pasos 1 y 2 del layout de release deben
> coincidir con lo que empaqueta el workflow. Si cambias uno, cambia el otro o
> el bundle portátil dejará de encontrar su motor.

### 2.3 Frontend

```
frontend/src/
├── lib/
│   ├── api.js                    # Fachada única hacia el backend
│   ├── stores/
│   │   ├── theme.js              # 'light' | 'dark' | 'system', persiste en localStorage
│   │   ├── i18n.js               # Locale + store derivado `t(key, vars)`
│   │   └── notifications.js      # Cola de toasts con auto-eliminación
│   ├── i18n/locales.js           # Diccionario de traducciones
│   └── components/               # 9 componentes de presentación
├── routes/
│   ├── +layout.svelte            # Monta ToastContainer y el tema inicial
│   └── +page.svelte              # Pantalla principal (feed, favoritos, búsqueda)
└── test/setup.js                 # Setup global de Vitest
```

**`api.js` es el único punto que habla con `window.go.main.App`.** El resto de
componentes usa `gower.*` (los builders de comando) o los helpers
(`mapThumbnails`, `normalizeId`). Si añades una capacidad del CLI, se añade un
método al objeto `gower` de `api.js`, nunca una llamada directa al binding.

#### `extractJson`

El CLI no siempre emite JSON puro: antepone líneas de log (`[DEBUG] ...`) y a
veces añade texto de error. `extractJson` recupera el payload probando **cada**
candidato `{` o `[` en orden de aparición:

- Escanea hacia adelante contando anidamiento de `{`/`[` y respetando cadenas
  y escapes, así que un `}` dentro de un string no descuadra el balanceo.
- Descarta el candidato si el primer cierre no corresponde al tipo de apertura
  (es el caso de `[DEBUG]`, que no es JSON) o si `JSON.parse` falla.
- Devuelve el primero que parsea; si ninguno, `null` y `runGower` devuelve el
  texto crudo.

Por eso **el orden importa**: `{"data":[1,2]}` devuelve el objeto completo, no
el array anidado.

#### Tabla de comandos del objeto `gower`

| Método | Comando |
|---|---|
| `getStatus()` | `status --json` |
| `getFeed(page, limit, color, sort)` | `feed show ... --json` |
| `setWallpaper(id, monitor)` | `set <id> [--target-monitor <m>]` *(background)* |
| `setRandom(monitor)` | `set random [--target-monitor <m>]` *(background)* |
| `getFavorites(page, limit, color, sort)` | `favorites list ... --json` |
| `addFavorite(id)` / `removeFavorite(id)` | `favorites add|remove <id>` |
| `blacklist(id)` | `blacklist add <id>` |
| `download(id)` | `download <id> --to-collection` *(background)* |
| `search(text, provider, page)` | `explore <text> --provider <p> --page <n> --json` |
| `deleteWallpaper(id)` | `wallpaper <id> --delete --file --force` |
| `undoWallpaper()` | `set undo` *(background)* |
| `getDaemonStatus()` / `toggleDaemon(on)` | `daemon status --json` / `daemon start|stop` |
| `getConfig()` / `setConfig(k, v)` | `config show --json` / `config set <k>=<v>` |
| `addProvider` / `removeProvider` | `config provider add|remove ...` |
| `addRedditProvider(sub, sort)` | `config provider add reddit-<sub> <url>` |
| `getCurrentWallpapers()` | `status --wallpapers --json` |
| `getMonitors()` | `status --monitors --json` |
| `getFeedColors()` / `getFavoritesColors()` | `feed\|favorites get colors --json` |
| `updateFeed()` | `feed update` *(background)* |

*(background)* = se ejecuta con `background=true`: el backend no espera y emite
el evento `gower-command-finished` cuando termina. Si el comando falla, emite
además `gower-command-failed` con `{args, error}` —el `stderr` de gower ya
resumido—, que es lo que dispara el toast de error en la UI. Sin ese evento el
fallo solo quedaba en el stdout de la app y la acción parecía no hacer nada.

### 2.4 Carga de miniaturas

El frontend nunca puede leer el sistema de ficheros por sí solo. Las imágenes
locales se sirven a través del `AssetServer.Handler` de Wails
(`main.go:50`), bajo el prefijo `/local-asset/`:

```
/local-asset//home/user/wall.png   →  main.go:54  →  http.ServeFile
```

`mapThumbnails()` decide la URL final con esta prioridad:

1. `thumbnail` o `url` si es `http…` o `data:` → se usa tal cual.
2. `path` absoluto (`/…`, `C:\…`, `\\…`) → `/local-asset/<path>`.
3. `id` + `ext` → `<cachePath>/thumbs/<id><ext>` bajo `/local-asset/`.
4. Sin nada utilizable → `thumbnail: ""`.

El handler hace `PathUnescape`, `filepath.Clean` y fuerza ruta absoluta en
Linux antes de servir el fichero.

## 3. Build y empaquetado

### Requisitos

- Go (la versión está fijada en `go.mod`)
- Node.js 20+
- Wails CLI v2
- Linux: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`

### Comandos

```bash
make install-deps   # npm install en frontend/
make frontend-build # vite build → frontend/build
make build          # wails build -tags webkit2_41
make dev            # wails dev (recarga en caliente)
make clean          # borra build/ y frontend/build/
```

> **El tag `webkit2_41` es obligatorio en Linux.** Está en `wails.json` y en
> `WAILS_TAGS` del `Makefile`. Sin él, la compilación falla con errores de
> WebKitGTK.

> **`frontend/build` es obligatorio para cualquier comando de Go.** El
> `//go:embed all:frontend/build` de `main.go:24` hace que `go build`,
> `go vet` y `go test` fallen si el directorio no existe. Por eso los targets
> del `Makefile` declaran dependencia de `frontend/build/index.html`.

### Versionado

La versión vive en **dos** sitios que deben coincidir:

- `wails.json` → `info.productVersion` (**fuente de verdad**)
- `frontend/package.json` → `version`

Del `wails.json` sale todo lo demás: el `Makefile` la lee y la inyecta en el
binario con `-ldflags "-X main.version=..."`, y el workflow de release hace lo
mismo y además la usa para nombrar el tag del release.

La UI la lee con `getAppVersion()`. Sin inyección vale `"dev"`, que es lo que
ve un `go build` a pelo; nunca debería enseñarse `"dev"` en una release, así que
si aparece es que el binario se compiló fuera del `Makefile`.

## 4. Sidecar

El binario `gower` **no se embebe** en el ejecutable. Los únicos `//go:embed`
son el frontend y el favicon. El flujo es:

1. En runtime, `lookupGowerPath()` lo localiza: Ajustes → **junto al
   ejecutable** → `$PATH` → rutas de instalación habituales.
2. Si no lo encuentra, la UI pide al usuario que lo seleccione con `PickFile()`.
3. El usuario puede fijar una ruta fija con `SetCustomGowerPath()`, que se
   antepone al resto (si la ruta guardada deja de existir, se ignora y se sigue
   buscando, no se bloquea la app).

El paso 1 es el que hace funcionar el bundle portable: el ejecutable busca
`gower` en su propio directorio.

El empaquetado de release sí lo incluye: el workflow `build-release` descarga
el sidecar del tag fijado en `.gower-version` y lo coloca junto al binario
(`gower` en Linux, `gower.exe` en Windows), que es exactamente lo que espera
`lookupGowerPath()`.

`.gower-version` es la **única fuente de verdad** de la versión del sidecar. El
workflow ya **no** consulta `releases/latest`: descarga por URL de release del
tag fijado y falla si el tag o el asset no existen. Además verifica el
`sha256` del binario contra el `checksums.txt` de la release antes de
empaquetarlo. Así una release es reproducible, íntegra y se puede revertir el
pin.

`frontend/src/lib/sidecar-info.json` se **genera desde el pin** con
`scripts/render-sidecar-info.sh` (`make sidecar-info`), tanto en local como en
CI, para que no haya un valor commiteado que no corresponda a lo empaquetado.
Para comprobar que el pin apunta a una release real: `make verify-sidecar`.

## 5. CI/CD

`.github/workflows/build-release.yml`, dos jobs:

| Job | Cuándo | Qué hace |
|---|---|---|
| `test` | PR y push a `main` | `make lint`, `make typecheck`, `make test-unit`, `make test-integration` en `ubuntu-22.04` |
| `build-release` | Tags `v*` y `workflow_dispatch` | Depende de `test`. Compila en Linux y Windows, descarga el sidecar del pin `.gower-version`, empaqueta portable y publica el release |

El job `test` corre siempre antes de publicar un release: no se publica un binario
cuyo test haya fallado.

Además, `.github/workflows/bump-sidecar.yml` recibe un `repository_dispatch`
(`gower-release`) que gower envía al publicar un tag, y abre un PR que solo
bumpea `.gower-version`. Requiere el secreto `GOWER_DISPATCH_TOKEN` en gower
(un PAT con permiso sobre este repo). Si el secreto no existe, gower omite el
aviso y la release sigue igual; el bump se puede lanzar a mano con
`workflow_dispatch`.

## 6. Testing

```bash
make test              # test-unit + test-integration
make test-unit         # go test ./...  +  vitest run
make test-integration  # go vet ./...   +  go build
make test-contract     # verifica el contrato contra el binario pineado (necesita GOWER_BIN)
make lint              # gofmt -l + go vet
make typecheck         # svelte-check
make check             # lint + typecheck + test
```

- **Backend**: `app_test.go`, `package main`, tabla de tests con la stdlib
  (sin testify). Los helpers `fakeGower` (script shell falso en `t.TempDir()`)
  e `isolateHostWithoutGower` aíslan el host del ejecutable real.
- **Contrato** (`contract_test.go`): `TestGowerContractFile` comprueba que el
  contrato del tag pineado (`GOWER_CONTRACT`) sigue declarando las claves que
  consume la UI; `TestGowerContractCommands` ejecuta el binario pineado
  (`GOWER_BIN`) sobre un `HOME` aislado y valida las salidas `--json`
  *headless-safe*. Ambos se **omiten** si las variables no están definidas, así
  que `make test` sigue corriendo sin el binario. El CI los cablea en el job
  `test` descargando el pin.
- **Frontend**: Vitest + `jsdom`. `frontend/src/test/setup.js` mockea
  `localStorage` y `matchMedia`. Cobertura actual: `api.js`, y los stores
  `theme`, `i18n` y `notifications`.
- **E2E**: el script `npm run test:e2e` existe pero **no hay specs ni
  `playwright.config.js`**. `make test` lo excluye a propósito.

## 7. Seguridad

- El frontend corre en un sandbox de WebView; solo accede al sistema a través
  de los bindings expuestos en la tabla de la sección 2.1.
- `PickFile` y `PickDirectory` presentan diálogos nativos; no hay un campo de
  texto libre para escribir rutas a mano
  escrito a mano (salvo `OpenPath`, que sí recibe lo que le pasa la UI).
- El handler `/local-asset/` sirve cualquier fichero legible por el proceso. Es
  una superficie conocida: revisar antes de exponer la app en red.

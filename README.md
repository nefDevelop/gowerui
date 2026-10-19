<p align="center">
  <img src="frontend/static/favicon.png" alt="gowerUI Logo" width="128">
</p>

# gowerUI

> [!WARNING]
> **Estado del Proyecto: Beta**. Esta aplicación está en una etapa temprana de
> desarrollo y requiere pruebas exhaustivas. Úsala bajo tu responsabilidad. El
> desarrollador no se hace responsable de posibles errores o comportamientos
> inesperados en tu sistema.

**gowerUI** es una interfaz gráfica multiplataforma para el gestor de fondos de
pantalla [gower](https://github.com/nefDevelop/gower). Está construida con
**Wails v2** y **SvelteKit**.

La aplicación usa el binario `gower` como **sidecar**: no reimplementa la lógica
de gestión de fondos, delega en el CLI y traduce su salida JSON a la interfaz.

En las releases oficiales `gower` viaja como fichero hermano del ejecutable, así
que no necesitas instalarlo aparte. La versión empaquetada está fijada en
[`.gower-version`](.gower-version) y el build verifica su `sha256` contra el
`checksums.txt` de la release de gower. Si ejecutas desde el código, la app lo
busca en este orden:

1. La ruta que hayas fijado en Ajustes.
2. Junto al propio ejecutable (`gower` o `gower.exe`, o en `bin/`).
3. El `$PATH` y las rutas de instalación habituales (`~/go/bin`,
   `~/.local/bin`, `/usr/local/bin`, `/usr/bin`).

## Características

- **Sidecar integrado**: las releases incluyen la versión de `gower` fijada en
  `.gower-version`, sin dependencias externas.
- **Sidecar configurable**: si ejecutas desde el código, `gower` se busca en el
  `$PATH` y en las rutas habituales, o puedes fijar una ruta en Ajustes.
- **Temas**: modo claro, oscuro y sincronización con el sistema.
- **Idiomas**: español e inglés, con detección automática.
- **Gestión de wallpapers**: explorar, filtrar, ordenar y aplicar fondos con un
  clic.
- **Detección de batería**: en portátiles, la interfaz muestra los ajustes de
  energía.
- **Bandeja del sistema**: acceso rápido para cambiar el fondo o abrir la
  interfaz.

## Tecnologías

- **Frontend**: [SvelteKit](https://kit.svelte.dev/) + [Vite](https://vitejs.dev/)
- **Backend**: [Go](https://go.dev/) + [Wails v2](https://wails.io/)
- **Estilos**: CSS sin framework
- **Sidecar**: [gower (Go)](https://github.com/nefDevelop/gower)

## Desarrollo local

### Requisitos

- [Go](https://go.dev/doc/install) (la versión exacta está fijada en `go.mod`)
- [Node.js](https://nodejs.org/) (v20+)
- [Wails CLI v2](https://wails.io/docs/gettingstarted/installation)
- Bibliotecas de sistema (en Linux): `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`,
  `libayatana-appindicator3-dev`.

### Pasos

1. Clonar y entrar:

   ```bash
   git clone https://github.com/nefDevelop/gowerGUI.git
   cd gowerGUI
   ```

2. Instalar dependencias del frontend:

   ```bash
   make install-deps
   ```

3. Ejecutar en modo dev:

   ```bash
   make dev
   ```

## Tests

Todo se orquesta con `make`:

| Comando | Qué hace |
|---|---|
| `make test` | Suite completa: `test-unit` + `test-integration` |
| `make test-unit` | Tests unitarios de Go y del frontend (Vitest) |
| `make test-integration` | `go vet` + `go build` (verifica los assets embebidos) |
| `make test-contract` | Verifica el contrato contra el sidecar fijado (necesita `GOWER_BIN`) |
| `make lint` | `gofmt` + `go vet` |
| `make typecheck` | `svelte-check` |
| `make check` | `lint` + `typecheck` + `test` |

La documentación técnica (arquitectura, bindings, protocolo de assets) está en
[`DOCUMENTATION.md`](DOCUMENTATION.md).

## Compilación

Para compilar la aplicación para tu plataforma actual:

```bash
make build
```

En Linux es obligatorio el tag `webkit2_41` (ya incluido en el target), que
selecciona WebKitGTK 4.1.

## Instalación local (Linux)

`make install` compila la app (si hace falta), descarga el sidecar `gower` del
tag fijado en `.gower-version` —verificando el checksum publicado en la
release— y lo instala todo en `$PREFIX`, por defecto `~/.local`. No hace falta
`sudo`:

| Qué | Dónde |
|---|---|
| `gowerui` y el sidecar `gower` | `~/.local/bin/` |
| Lanzador del menú | `~/.local/share/applications/gowerui.desktop` |
| Icono | `~/.local/share/icons/hicolor/128x128/apps/gowerui.png` |

El binario y el sidecar quedan como ficheros hermanos, que es el layout que
resuelve `lookupGowerPath`, así que la instalación es autocontenida. Para otro
prefijo, `make install PREFIX=/usr/local` (en ese caso sí necesitas permisos de
escritura).

## Contrato con gower

La app depende de la salida `--json` de `gower`. Ese formato es un contrato
público que gower declara en
[`contract/gower-contract.json`](https://github.com/nefDevelop/gower/blob/main/contract/gower-contract.json).
`make test-contract` descarga el binario y el contrato del tag fijado y
comprueba que las claves que consume la interfaz siguen presentes. En CI se
ejecuta en cada push.

## Estado y limitaciones

- Los ajustes de energía que muestra la interfaz (pausar con batería baja y
  umbral) todavía no los consume `gower`: quedan como paso pendiente en el
  roadmap de gower.
- Los tests E2E y de componentes Svelte están pendientes (ver
  [`ROADMAP.md`](ROADMAP.md)).

## Contribuir

Si encuentras un error o tienes una idea de mejora, abre un issue o envía un PR.

## Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

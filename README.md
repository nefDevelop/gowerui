<p align="center">
  <img src="frontend/static/favicon.png" alt="gowerGUI Logo" width="128">
</p>

# gowerUI

> [!WARNING]
> **Estado del Proyecto: Beta**. Esta aplicación se encuentra en una etapa temprana de desarrollo y requiere pruebas exhaustivas. Úsala bajo tu propia responsabilidad. El desarrollador no se hace responsable de posibles errores o comportamientos inesperados en tu sistema.

**gowerUI** es una interfaz gráfica moderna, rápida y multiplataforma para el gestor de fondos de pantalla [gower](https://github.com/nefDevelop/gower). Construida con **Wails v2** y **SvelteKit**, ofrece una experiencia nativa con un diseño refinado.

La aplicación usa el binario `gower` como un **sidecar**: no reimplementa la lógica de gestión de fondos, delega en el CLI y traduce su salida JSON a la interfaz.

En las releases oficiales `gower` viaja como fichero hermano del ejecutable, así que no necesitas instalarlo aparte. Si ejecutas desde el código, la app lo busca en este orden:

1. La ruta que hayas fijado en **Ajustes**.
2. Junto al propio ejecutable (`gower` o `gower.exe`, o en `bin/`).
3. El `$PATH` y las rutas de instalación habituales (`~/go/bin`, `~/.local/bin`, `/usr/local/bin`, `/usr/bin`).

## ✨ Características Principales

- **🚀 Sidecar Integrado**: Empaqueta la última versión de `gower` en las releases, sin dependencias externas.
- **🔧 Sidecar Configurable**: Si ejecutas desde el código, `gower` se busca en el `$PATH` y en las rutas habituales, o puedes fijar una ruta en Ajustes.
- **🎨 Temas Inteligentes**: Soporte para modo claro, oscuro y sincronización con el sistema.
- **🌍 Multi-idioma (i18n)**: Interfaz disponible en varios idiomas con detección automática.
- **🖼️ Gestión de Wallpapers**: Explora, filtra, ordena y aplica fondos de pantalla con un solo clic.
- **🔋 Optimización de Energía**: Sensor de batería integrado para pausar o ajustar comportamientos en portátiles.
- **Tray Icon**: Acceso rápido desde la bandeja del sistema para cambiar fondos o abrir la interfaz.

## 🛠️ Tecnologías

- **Frontend**: [SvelteKit](https://kit.svelte.dev/) + [Vite](https://vitejs.dev/)
- **Backend**: [Go](https://go.dev/) + [Wails v2](https://wails.io/)
- **Estilos**: Vanilla CSS (Diseño limpio y ligero)
- **Sidecar**: [gower (Golang)](https://github.com/nefDevelop/gower)

## 💻 Desarrollo Local

### Requisitos
- [Go](https://go.dev/doc/install) (la versión exacta está fijada en `go.mod`)
- [Node.js](https://nodejs.org/) (v20+)
- [Wails CLI v2](https://wails.io/docs/gettingstarted/installation)
- Bibliotecas de sistema (en Linux): `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`.

### Pasos
1. **Clonar y entrar**:
   ```bash
   git clone https://github.com/nefDevelop/gowerGUI.git
   cd gowerGUI
   ```
2. **Instalar dependencias del frontend**:
   ```bash
   make install-deps
   ```
3. **Ejecutar en modo dev**:
   ```bash
   make dev
   ```

## 🧪 Desarrollo y tests

Todo se orquesta con `make`:

| Comando | Qué hace |
|---|---|
| `make test` | Suite completa: `test-unit` + `test-integration` |
| `make test-unit` | Tests unitarios de Go y del frontend (Vitest) |
| `make test-integration` | `go vet` + `go build` (verifica los assets embebidos) |
| `make lint` | `gofmt` + `go vet` |
| `make typecheck` | `svelte-check` |
| `make check` | `lint` + `typecheck` + `test` |

La documentación técnica (arquitectura, bindings, protocolo de assets) está en
[`DOCUMENTATION.md`](DOCUMENTATION.md).

## 📦 Compilación

Para compilar la aplicación para tu plataforma actual:
```bash
make build
```

En Linux es obligatorio el tag `webkit2_41` (ya incluido en el target), que
selecciona WebKitGTK 4.1.

## 🤝 Contribuir

Si encuentras un error o tienes una idea para una mejora, ¡no dudes en abrir un issue o enviar un PR!

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

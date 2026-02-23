# gowerGUI

**gowerGUI** es una interfaz gráfica moderna y elegante para [gower](https://github.com/nef6/gower) (u otro backend compatible), construida con **Tauri v2** y **SvelteKit**.

Permite gestionar fondos de pantalla, configuraciones y visualizar el estado del sistema de manera intuitiva.

## 🚀 Características

- **Gestión de Wallpapers**: Visualiza, ordena y aplica fondos de pantalla.
- **Interfaz Moderna**: Diseño limpio y responsivo utilizando Svelte y TailwindCSS (o CSS custom).
- **Integración con Sistema**: Comandos nativos para cambiar fondos, verificar batería, etc.
- **Multi-plataforma**: Diseñado para Linux (principalmente), con soporte planificado para Windows y macOS.

## 🛠 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

1.  **Rust**: [Instalar Rust](https://www.rust-lang.org/tools/install)
2.  **Node.js** (v18+): [Instalar Node.js](https://nodejs.org/)
3.  **gower**: El binario backend. La aplicación busca `gower` en el `$PATH` del sistema.
    - Asegúrate de que `gower` esté instalado y sea ejecutable.

## 💻 Instalación y Desarrollo

1.  **Clonar el repositorio**:

    ```bash
    git clone https://github.com/tu-usuario/gowerGUI.git
    cd gowerGUI/gowerui
    ```

2.  **Instalar dependencias de Node**:

    ```bash
    npm install
    ```

3.  **Ejecutar en modo desarrollo**:
    ```bash
    npm run tauri dev
    ```
    Esto iniciará tanto el frontend (Vite) como la ventana de Tauri.

## 📦 Construcción (Build)

Tauri utiliza el compilador nativo del sistema operativo.

### Linux

Para generar paquetes `.deb` y `.AppImage`:

```bash
npm run tauri build
```

El binario se generará en `src-tauri/target/release/bundle/`.

## 🔒 Seguridad

Consulta [SECURITY.md](SECURITY.md) para detalles sobre nuestra política de seguridad y cómo reportar vulnerabilidades.

## 🗺 Roadmap

Consulta [ROADMAP.md](ROADMAP.md) para ver los planes futuros del proyecto.

## 📄 Licencia

[MIT](LICENSE) (o la licencia que elijas).

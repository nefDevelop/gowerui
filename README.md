<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="gowerGUI Logo" width="128">
</p>

# gowerUI

> [!WARNING]
> **Estado del Proyecto: Beta**. Esta aplicación se encuentra en una etapa temprana de desarrollo y requiere pruebas exhaustivas. Úsala bajo tu propia responsabilidad. El desarrollador no se hace responsable de posibles errores o comportamientos inesperados en tu sistema.

**gowerUI** es una interfaz gráfica moderna, rápida y multiplataforma para el gestor de fondos de pantalla [gower](https://github.com/nefDevelop/gower). Construida con **Tauri v2** y **SvelteKit**, ofrece una experiencia nativa con un diseño refinado.

La aplicación integra el binario `gower` como un **sidecar**, lo que significa que no necesitas instalar nada por separado: todo lo necesario para gestionar tus fondos de pantalla viene incluido en el ejecutable.

## ✨ Características Principales

- **🚀 Sidecar Integrado**: Utiliza la última versión de `gower` automáticamente sin dependencias externas.
- **🎨 Temas Inteligentes**: Soporte para modo claro, oscuro y sincronización con el sistema.
- **🌍 Multi-idioma (i18n)**: Interfaz disponible en varios idiomas con detección automática.
- **🖼️ Gestión de Wallpapers**: Explora, filtra, ordena y aplica fondos de pantalla con un solo clic.
- **🔋 Optimización de Energía**: Sensor de batería integrado para pausar o ajustar comportamientos en portátiles.
- **Tray Icon**: Acceso rápido desde la bandeja del sistema para cambiar fondos o abrir la interfaz.

## 🛠️ Tecnologías

- **Frontend**: [SvelteKit](https://kit.svelte.dev/) + [Vite](https://vitejs.dev/)
- **Backend**: [Rust](https://www.rust-lang.org/) + [Tauri v2](https://v2.tauri.app/)
- **Estilos**: Vanilla CSS (Diseño limpio y ligero)
- **Sidecar**: [gower (Golang)](https://github.com/nefDevelop/gower)

## 💻 Desarrollo Local

### Requisitos
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Node.js](https://nodejs.org/) (v20+)
- Bibliotecas de sistema (en Linux): `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`.

### Pasos
1. **Clonar y entrar**:
   ```bash
   git clone https://github.com/nefDevelop/gowerGUI.git
   cd gowerGUI/gowerui
   ```
2. **Instalar dependencias**:
   ```bash
   npm install
   ```
3. **Ejecutar**:
   ```bash
   npm run tauri dev
   ```

## 📦 Compilación y Versiones

El proyecto utiliza **GitHub Actions** para automatizar el ciclo de vida:
- **Detección de Versiones**: Cada build descarga automáticamente la última versión estable del binario `gower`.
- **Artefactos**: Se generan ejecutables listos para usar (`.AppImage`, `.deb` para Linux; `.msi`, `.exe` para Windows).
- **Transparencia**: El archivo `src/lib/sidecar-info.json` registra exactamente qué versión del motor `gower` se está utilizando en cada compilación.

## 🤝 Contribuir

Si encuentras un error o tienes una idea para una mejor

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

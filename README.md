<p align="center">
  <img src="frontend/static/favicon.png" alt="gowerGUI Logo" width="128">
</p>

# gowerUI

> [!WARNING]
> **Estado del Proyecto: Beta**. Esta aplicación se encuentra en una etapa temprana de desarrollo y requiere pruebas exhaustivas. Úsala bajo tu propia responsabilidad. El desarrollador no se hace responsable de posibles errores o comportamientos inesperados en tu sistema.

**gowerUI** es una interfaz gráfica moderna, rápida y multiplataforma para el gestor de fondos de pantalla [gower](https://github.com/nefDevelop/gower). Construida con **Wails v2** y **SvelteKit**, ofrece una experiencia nativa con un diseño refinado.

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
- **Backend**: [Go](https://go.dev/) + [Wails v2](https://wails.io/)
- **Estilos**: Vanilla CSS (Diseño limpio y ligero)
- **Sidecar**: [gower (Golang)](https://github.com/nefDevelop/gower)

## 💻 Desarrollo Local

### Requisitos
- [Go](https://go.dev/doc/install) (1.22+)
- [Node.js](https://nodejs.org/) (v20+)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)
- Bibliotecas de sistema (en Linux): `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`.

### Pasos
1. **Clonar y entrar**:
   ```bash
   git clone https://github.com/nefDevelop/gowerGUI.git
   cd gowerGUI
   ```
2. **Ejecutar en modo dev**:
   ```bash
   wails dev
   ```

## 📦 Compilación

Para compilar la aplicación para tu plataforma actual:
```bash
wails build
```

## 🤝 Contribuir

Si encuentras un error o tienes una idea para una mejora, ¡no dudes en abrir un issue o enviar un PR!

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

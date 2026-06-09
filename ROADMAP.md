# Roadmap del Proyecto gowerGUI

Este documento describe los pasos necesarios y las características planificadas para el desarrollo futuro de gowerGUI.

## ✅ Fase 1: Migración a Wails (Completado)
- [x] Migrar el backend de Rust/Tauri a Go/Wails.
- [x] Implementar bindings para ejecución de comandos, gestión de archivos y estado de batería.
- [x] Adaptar el frontend (SvelteKit) para comunicarse con Wails.
- [x] Limpiar dependencias y archivos de Tauri.

## 🛠 Fase 2: Robustez y Funcionalidad
- [x] **Manejo de rutas dinámico**: Buscar `gower` en el `$PATH` o usar configuración manual.
- [x] **Soporte de Batería**: Implementar chequeo para Linux y Windows en Go.
- [x] **Manejo de Errores**: Feedback visual en la UI cuando el backend falla.
- [x] **Internacionalización (i18n)**: Soporte completo para múltiples idiomas.
- [x] **Temas**: Soporte para temas claro/oscuro sincronizados con el sistema.

## 🌟 Fase 3: Características Futuras
- [ ] **Actualizaciones Automáticas**: Implementar un sistema de actualización para la aplicación.
- [ ] **CI/CD**: Configurar GitHub Actions para builds automáticos (Wails).
- [ ] **Mejoras en el Tray**: Añadir más opciones rápidas al menú de la bandeja.
- [ ] **Soporte para más plataformas**: Validar y mejorar la experiencia en macOS y Windows.

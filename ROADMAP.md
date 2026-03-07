# Roadmap del Proyecto gowerGUI

Este documento describe los pasos necesarios y las características planificadas para preparar el proyecto para su publicación en GitHub y su desarrollo futuro.

## 🚀 Fase 1: Preparación para GitHub (Inmediato)

### 🔒 Seguridad
- [x] **Restringir `assetProtocol`**: Actualmente configurado en `["**"]`, lo que permite acceso total al sistema de archivos. Debe limitarse a directorios específicos.
- [x] **Revisar CSP**: `unsafe-inline` en estilos presenta riesgos. Evaluar si es estrictamente necesario o si se puede eliminar. (Mantenido por requerimientos de Svelte/Transitions).
- [x] **Sanitización de Comandos**: Validar los argumentos pasados a `run_gower_command` para prevenir ejecución de acciones no deseadas. (Validado: uso seguro de `Command` con args vector).

### 📄 Documentación
- [x] **README.md Completo**:
  - Descripción del proyecto.
  - Requisitos previos (Rust, Node.js, binario `gower`).
  - Instrucciones de instalación y compilación.
  - Estructura del proyecto.
- [x] **LICENSE**: Elegir y agregar una licencia (MIT, Apache 2.0, GPL, etc.).


### ⚙️ Configuración
- [x] **Metadatos de Cargo.toml**: Actualizar autores, descripción y repositorio.
- [x] **Metadatos de tauri.conf.json**: Asegurar que el `identifier` sea único y correcto.
- [x] **.gitignore**: Verificar que no se incluyan archivos sensibles o innecesarios.

## 🛠 Fase 2: Robustez y Cross-Platform (Corto Plazo)

- [x] **Manejo de rutas dinámico**: Eliminar la dependencia hardcodeada de `~/go/bin/gower`.
  - Buscar en `$PATH`.
  - Permitir configuración manual en la UI si no se encuentra.
  - Opción de incluir el binario (sidecar) en el bundle final.
- [x] **Soporte de Batería**: Implementar chequeo real para Windows y macOS (actualmente stub).

## Fase 3: 
- [x] **Manejo de Errores**: Mejorar la UI cuando el backend `gower` falla o no se encuentra.Frontend Error Feedback: Implementar notificaciones visuales (toast/banner) en la UI cuando ocurran errores en el backend (ej. si no se encuentra gower en ninguna ruta).
- [x] **Internacionalización (i18n)**: Soporte para múltiples idiomas.
- [x] **Temas**: Soporte completo para temas claro/oscuro (detectar sistema).

## 🌟 Fase 4: Features Futuras (Largo Plazo)
- [ ] **Actualizaciones Automáticas**: Configurar el updater de Tauri.
- [ ] **CI/CD**: Configurar GitHub Actions para tests y builds automáticos en cada push.

# Política de Seguridad

Este proyecto toma la seguridad en serio. Agradecemos tus esfuerzos para mejorar la seguridad de gowerGUI.

## Reportar una Vulnerabilidad

Si encuentras una vulnerabilidad de seguridad en gowerGUI, por favor **NO** abras un issue público. En su lugar, envía un reporte por correo electrónico a [nefdevelop@gmail.com] (o la dirección de contacto del mantenedor).

Incluye tanta información como sea posible para ayudarnos a reproducir y solucionar el problema.

## Medidas de Seguridad Actuales

### Tauri Security
- **Isolation Pattern**: Utilizamos el patrón de aislamiento de Tauri para separar el frontend del backend.
- **Scope Restringido**: (En proceso) El acceso al sistema de archivos está restringido a directorios específicos necesarios para la aplicación.
- **CSP**: Se implementa una Política de Seguridad de Contenido para prevenir XSS.

### Advertencias Conocidas
- La aplicación actualmente permite la ejecución de un binario externo (`gower`). Asegúrate de tener una versión confiable de este binario instalada.
- El protocolo de assets (`asset:`) se utiliza para cargar imágenes locales.

## Versiones Soportadas

Actualmente solo soportamos la última versión estable del proyecto.

| Versión | Soportada |
| ------- | --------- |
| 0.1.x   | ✅        |
| < 0.1.0 | ❌        |

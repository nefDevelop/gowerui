# Política de Seguridad

Este proyecto toma la seguridad en serio. Agradecemos tus esfuerzos para mejorar la seguridad de gowerGUI.

## Reportar una Vulnerabilidad

Si encuentras una vulnerabilidad de seguridad en gowerGUI, por favor **NO** abras un issue público. En su lugar, envía un reporte por correo electrónico a [nefdevelop@gmail.com] (o la dirección de contacto del mantenedor).

Incluye tanta información como sea posible para ayudarnos a reproducir y solucionar el problema.

## Medidas de Seguridad Actuales

### Seguridad en Wails
- **Bindings Restringidos**: Solo las funciones necesarias están expuestas al frontend a través de los bindings de Wails.
- **Comunicación Segura**: La comunicación entre el frontend y el backend se realiza a través del runtime de Wails.

### Advertencias Conocidas
- La aplicación actualmente permite la ejecución de un binario externo (`gower`). Asegúrate de tener una versión confiable de este binario instalada.
- El protocolo de assets local se utiliza para cargar imágenes desde el sistema de archivos (miniaturas).

## Versiones Soportadas

Actualmente solo soportamos la última versión estable del proyecto.

| Versión | Soportada |
| ------- | --------- |
| 0.2.x   | ✅        |
| < 0.2.0 | ❌        |

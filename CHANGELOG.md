# Cambios

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones: [SemVer](https://semver.org/lang/es/)
(antes de 1.0, cada versión con funciones nuevas sube el número del medio).

## [0.2.0] — 2026-10-06

### Añadido
- **Estilo "Taller + Cuadro de mandos"**: cuadro con odómetro de rodillos y arco del próximo mantenimiento,
  testigos de estado, indicadores circulares y partes de trabajo en tabla.
- **5 temas** (Taller, Británico, Petróleo, Nocturno, Neón), cada uno en claro y oscuro.
- **Escritorio**: menú lateral contraíble, contenido centrado y rejillas.
- **Foto de perfil** de cada vehículo (cámara o galería), reducida en el dispositivo.
- **Editar registros** y pantalla de **Kilómetros** para corregir lecturas, con aviso de las que parecen erróneas.
- **Exportar e importar** copia de seguridad (fusiona sin borrar nada).
- **Avisos locales**: "se acerca", "toca hoy", resumen semanal de vencidos y petición de km.
- **Ritmo de km**: estimación de cuándo tocará cada tarea por km ("≈ 12 nov a tu ritmo").
- **Tareas personalizadas** con su propio intervalo.
- **App Android** con logo (Monograma G), icono adaptativo y temático, y pantalla de inicio.

### Cambiado
- Intervalos por tiempo en **años** en lugar de días.

### Corregido
- Borrar un registro no quitaba su lectura de km.
- En Android, el botón ⚡ y el final de la lista quedaban bajo la barra de navegación del sistema.

## [0.1.0] — 2026-10-06

Primera versión: vehículos, odómetro, registros, motor de urgencias e ITV, historial, registro rápido,
plan de mantenimiento y modo oscuro. Todo local (SQLite), sin cuenta.

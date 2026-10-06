# Cambios

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones: [SemVer](https://semver.org/lang/es/)
(antes de 1.0, cada versión con funciones nuevas sube el número del medio).

## [0.5.0] — 2026-10-06

### Añadido
- **Widget de Android** con las tres tareas más urgentes de todos tus vehículos y un botón de registro
  rápido. Tocar una tarea abre ese vehículo.
- **Inglés**: la app sale en el idioma del móvil (español, o inglés para el resto). Se puede cambiar en
  Ajustes → Idioma. Los avisos y el widget también se traducen.

### Cambiado
- **Borrar un vehículo borra todos sus datos**: registros, repostajes, km, plan, tareas propias y
  aplazamientos. Al actualizar, también se limpian los datos que quedaron de vehículos borrados antes.
- Las cifras con decimales (litros, importes) se pueden escribir con coma o con punto.

## [0.4.0] — 2026-10-06

### Añadido
- **Repostajes**: litros, importe (con €/L al momento) y depósito lleno, desde el registro rápido con el
  selector "Mantenimiento | Repostaje". Su km cuenta como lectura del odómetro.
- **Consumo** de lleno a lleno (L/100 km, o L/h en vehículos por horas).
- **Pestaña Gastos**: total del año, gráfico mensual de mantenimiento y combustible, coste por km, consumo
  medio y comparativa por vehículo.
- **Posponer avisos** una semana, dos, un mes o unos km/horas; aviso cuando acaba el aplazamiento.
- **Kart y pitbike**, que se miden en **horas de motor** en lugar de km (sin ITV, matrícula ni vencimientos).
- **Más tareas de moto** (kit de transmisión, rodillos del variador, aceite de horquilla, sincronizar
  carburación…) con intervalos sugeridos según el tipo de vehículo.

### Cambiado
- **Plan de mantenimiento** agrupado por categorías, con filas compactas y un catálogo para añadir tareas.
- **Registro rápido** muestra primero lo que toca y lo del plan; el resto, en "Más tareas" con buscador.
- La ficha del vehículo mezcla registros y repostajes en un único **Historial**.
- Los datos de ejemplo incluyen repostajes.

## [0.3.0] — 2026-10-06

### Añadido
- **Seguro e impuesto de circulación** como vencimientos, junto a la ITV: fecha en el vehículo, aviso un mes
  antes y renovación apuntándolo en el registro rápido (el siguiente vencimiento se calcula solo).
- **Google Calendar**: botón en cada urgencia con fecha para crear el evento (fecha del vencimiento o la
  estimada a tu ritmo).
- **Quitar datos de ejemplo** desde Ajustes.
- **Tests de interfaz** con Playwright (`npm run test:e2e`).

### Cambiado
- Tarjetas de vehículo: un testigo de estado en lugar de la franja de color lateral.

### Corregido
- "Cargar datos de ejemplo" duplicaba los vehículos si se pulsaba dos veces.
- `npx cap sync` dejaba archivos de Android como modificados en git (solo por los saltos de línea).

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

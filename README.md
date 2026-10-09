# Garage

App para llevar el mantenimiento de motos y coches. Apuntas lo que le haces a cada vehículo (aceite, cadena,
frenos, ITV…) y la app calcula cuándo toca lo siguiente, por kilómetros, por tiempo o por lo que llegue antes,
y te avisa. También lleva los repostajes, el consumo y lo que te gastas.

Funciona sin conexión y sin cuenta: los datos se guardan en el dispositivo (SQLite). Está pensada para España
(intervalos de ITV por tipo de vehículo, seguro e impuesto de circulación) y en español e inglés.

La versión gratuita cubre hasta dos vehículos; Garage Pro, un pago único en Google Play, añade la pestaña de
gastos, vehículos sin límite, los temas de color y el widget.

Stack: Vue 3 + TypeScript, Ionic Vue, Capacitor 8, SQLite (`@capacitor-community/sqlite`; `jeep-sqlite` en la
web), Pinia, vue-i18n, date-fns, Zod, Vitest y Playwright.

## Empezar

```bash
npm install        # también copia sql-wasm.wasm a public/assets (postinstall)
npm run dev        # http://localhost:5173
npm test           # Vitest: urgencias, ITV, formato, consumo y repositorio contra SQLite de verdad
npm run test:e2e   # Playwright: la app manejada como un usuario, en móvil y escritorio (usa tu Chrome)
npm run build      # vue-tsc + vite build
```

En **Ajustes → Cargar datos de ejemplo** hay tres vehículos (CBR600RR, Scrambler y Corolla) con historial y
repostajes, para ver la app con datos. En desarrollo, la pantalla de Garage Pro tiene un botón que lo activa sin
pagar.

### Android

Hace falta **Node ≥ 22** (CLI de Capacitor 8), Android Studio con el SDK y un **JDK 21**. No hace falta que
`JAVA_HOME` apunte a él: `android/gradle/gradle-daemon-jvm.properties` le dice a Gradle que lo busque entre los
JDK instalados, así otros proyectos pueden seguir con el suyo.

```bash
npm run cap:sync          # compila la web y la copia a android/
npx cap open android      # y ▶ en Android Studio (móvil por USB o emulador)
```

- `npm run apk` genera un APK de depuración en `releases/garage-<versión>-debug.apk`, para instalarlo en tu
  móvil o pasárselo a quien vaya a probar.
- `npm run aab` genera el paquete firmado para Google Play en `releases/garage-<versión>.aab`. Necesita la
  clave de subida; los pasos de la publicación están en [store/PUBLICAR.md](store/PUBLICAR.md).
- `npm run store:shots` vuelve a sacar las capturas de la ficha de la tienda.

Con un APK de depuración se puede inspeccionar la app desde `chrome://inspect` en el Chrome del ordenador.

`android/` está en el repositorio porque lleva cosas que Capacitor no regenera: el widget, los plugins de
compra y del widget, la cámara en `<queries>`, el icono de los avisos y la firma de publicación.

## Estructura

```
src/
  domain/          Lógica sin Vue ni base de datos (todo con tests)
    reminders.ts     Qué toca: vencido / pronto / pospuesto / al día / sin historial
    itv.ts           Intervalos de la ITV en España por tipo de vehículo
    tasks.ts         Catálogo de tareas e intervalos por tipo de vehículo
    fuel.ts          Repostajes y consumo de lleno a lleno
    stats.ts         Gastos por mes y año, coste por km
    alerts.ts        Plan de avisos locales
    format.ts        Textos, cifras y fechas en el idioma de la app
  db/              Esquema con migraciones, repositorio y adaptadores de SQLite
  i18n/            Textos en español (es.ts) e inglés (en.ts)
  lib/             Plataforma: avisos, compra de Garage Pro, widget, archivos
  stores/garage.ts Estado (Pinia)
  views/           Pantallas
  theme/           Los 5 temas de color, en claro y oscuro
android/           Proyecto nativo (widget y compras en app/src/main/java)
web/privacy.html   Política de privacidad común de Lichium Dev (se publica en lichium.dev)
store/             Ficha de Google Play, capturas y guía de publicación
tests/  e2e/       Vitest y Playwright
```

## Decisiones

| Decisión | Por qué |
|---|---|
| UUID v7 generados en el dispositivo | Funciona sin conexión y se ordenan por fecha |
| Borrado lógico (`deleted_at`) | Al importar una copia, lo borrado sigue borrado |
| Dinero en céntimos y litros en centilitros, enteros | Sin errores de coma flotante |
| Km actuales = la lectura más alta | Cada registro o repostaje con km añade una lectura a `odometer_readings` |
| "Pronto" = el último 20 % del intervalo (como mucho 1.000 km / 30 días) | El engrase cada 500 km avisa a los 100; el aceite cada 6.000, a los 1.000 |
| ITV sin historial en un vehículo antiguo = "sin historial" | Mejor no dar por vencida una ITV que seguramente está pasada |
| Pit bike y kart por horas de motor | Se guardan en los mismos campos que los km; solo cambia cómo se muestran |
| `sql.js` fijado a **1.11.0** | Tiene que coincidir con la que lleva `jeep-sqlite@2.8.0`; si no, el `.wasm` no carga |
| Ionic en modo `ios` en todas las plataformas | El mismo aspecto en Android, iPhone y web |
| Temas como paletas de variables (`data-palette` en `<html>`) | Cambiar de tema no toca los componentes |
| Acento de relleno distinto del acento de texto | El amarillo, el cian o el rosa no se leen sobre blanco |
| Cuadro de instrumentos siempre oscuro | También en modo claro, como un panel |
| Fuentes incluidas en la app (`@fontsource`) | Sin depender de Google Fonts ni de la conexión |
| Compra de Pro sin servidor | La valida Google Play y se vuelve a consultar al abrir la app |

## Versiones

El detalle está en [CHANGELOG.md](CHANGELOG.md). La versión sale de `package.json`, y Android la toma de ahí.

- [x] **0.1:** vehículos, km, registros, urgencias e ITV, registro rápido, plan de mantenimiento
- [x] **0.2:** estilo "Taller + Cuadro" con 5 temas, escritorio, foto del vehículo, corregir registros y km,
  copias de seguridad, avisos, tareas propias, app de Android
- [x] **0.3:** seguro e impuesto, Google Calendar, tests de interfaz
- [x] **0.4:** posponer avisos, repostajes y gastos, más tareas de moto, kart y pit bike
- [x] **0.5:** widget de Android e inglés
- [ ] **1.0:** Garage Pro y todo lo necesario para Google Play. Falta la prueba cerrada y publicarla
  ([store/PUBLICAR.md](store/PUBLICAR.md))
- [ ] **Más adelante:** cuenta de Google y sincronización entre dispositivos, iOS

Hecha por Lichium Dev.

# 🏍️ Garage

App multiplataforma para llevar el mantenimiento de motos y vehículos personales.

- **¿Cuándo le hice esto?** Historial de cada mantenimiento.
- **¿A cuántos km toca ahora?** Motor de urgencias en km *y* en días.
- **Offline-first.** Todo en SQLite local; la sync en la nube llega en la fase 0.3.
- **España + motos.** ITV según tipo de vehículo, intervalos pensados para motos.

**Stack:** Vue 3 + TypeScript · Ionic Vue · Capacitor · SQLite (`@capacitor-community/sqlite`, `jeep-sqlite` en web) · Pinia · date-fns · uuid v7 · Zod · Vitest.

## Empezar

```bash
npm install        # copia también sql-wasm.wasm a public/assets (postinstall)
npm run dev        # http://localhost:5173
npm test           # Vitest: motor de urgencias, ITV, formato y repositorio contra SQLite real
npm run build      # vue-tsc + vite build
```

En **Ajustes → Cargar datos de ejemplo** tienes 3 vehículos (CBR600RR, Scrambler y Corolla) para ver la app con datos.

### Android

Requisitos: **Node ≥ 22** (CLI de Capacitor 8), Android Studio con el SDK y un **JDK 21** instalado.
No hace falta que `JAVA_HOME` apunte a él: `android/gradle/gradle-daemon-jvm.properties` le dice a Gradle
que busque un JDK 21 entre los instalados (así otros proyectos pueden seguir con el JDK que usen).

```bash
npm run cap:sync          # compila la web y la copia a android/
npx cap open android      # y ▶ en Android Studio (móvil por USB o emulador)
```

Desde terminal: `npx cap run android` (compila, instala y abre en el móvil o emulador que elijas), o
`cd android && ./gradlew assembleDebug` para generar `android/app/build/outputs/apk/debug/app-debug.apk`. Con un APK de depuración,
`chrome://inspect` en el Chrome del ordenador permite inspeccionar la app.

`android/` está versionada: lleva la configuración nativa que no regenera Capacitor
(`<queries>` de la cámara en el manifiesto, icono de los avisos `ic_stat_garage`).

## Estructura

```
src/
  domain/        Lógica pura, sin Vue ni BD (100 % testeable)
    reminders.ts   Motor de urgencias: vencido / pronto / al día / sin historial
    itv.ts         Intervalos de ITV en España por tipo de vehículo
    tasks.ts       Catálogo de tareas e intervalos por defecto por tipo
    schemas.ts     Validación de formularios con Zod
    format.ts      Textos y formato es-ES ("1.150 km · Toca a 24.200 km…")
  db/
    sql.ts         Interfaz mínima de BD (nativo, web y tests la implementan)
    migrations.ts  Esquema versionado
    repository.ts  Acceso a datos (borrado lógico, transacciones)
    capacitor.ts   Adaptador @capacitor-community/sqlite (+ jeep-sqlite en web)
    demo.ts        Datos de ejemplo
  stores/garage.ts Estado (Pinia) y urgencias derivadas
  views/           Garage, Detalle, Registro rápido, Recordatorios, Plan, Ajustes
  theme/           Estilo "Taller + Cuadro": 5 temas de color × claro/oscuro (palettes.css)
tests/             Vitest (sql.js en memoria para el repositorio)
```

## Decisiones

| Decisión | Por qué |
|---|---|
| UUID v7 generados en cliente | Offline y distribuido; ordenables por tiempo |
| Borrado lógico (`deleted_at`) | Nunca se pierden datos; necesario para la sync |
| Dinero en céntimos (`INTEGER`) + `currency` | Sin errores de coma flotante |
| Km actuales = lectura máxima | Cada registro con km añade una lectura en `odometer_readings` |
| "Pronto" = 20 % del intervalo (máx. 1.000 km / 30 días) | Engrase cada 500 km avisa a 100 km; aceite cada 6.000 km, a 1.000 km |
| Vencido siempre en rojo | En el mockup un +50 km salía naranja; aquí cualquier vencido es rojo |
| ITV sin historial en vehículo antiguo = "sin historial" | No dar por vencida una ITV que seguramente está pasada |
| `sql.js` fijado a **1.11.0** | Debe coincidir con la versión que `jeep-sqlite@2.8.0` lleva empaquetada; si no, el `.wasm` no carga |
| Ionic en modo `ios` en todas las plataformas | Estética Sesame homogénea |
| Temas = paletas de tokens (`data-palette` en `<html>`) | Cambiar de tema no toca componentes; cada tema define claro y oscuro |
| Acento de relleno ≠ acento de texto | Amarillo, cian o rosa no se leen sobre blanco: en claro, el texto usa una versión más oscura |
| Cuadro de instrumentos siempre oscuro | En modo claro sigue siendo un panel incrustado: el acento luce igual |
| Fuentes locales (`@fontsource`) | Offline-first: sin depender de Google Fonts |

## Roadmap

- [x] **0.1 MVP local:** vehículos, odómetro, registros, motor de urgencias + ITV, timeline, registro rápido, plan de mantenimiento, modo oscuro, tests
- [ ] **0.2:** adjuntos (tabla `documents` ya creada), seguro/impuesto, notificaciones locales, exportar/importar
- [ ] **0.3:** Supabase (auth, RLS, sync, borrar cuenta)
- [ ] **0.4:** repostajes, consumo, coste por mes y km
- [ ] **1.0:** beta cerrada, App Store + Google Play

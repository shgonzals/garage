# Recursos de marca

- `logo/garage-icon.svg` — **fuente del logo**: una G hecha con el arco de un reloj; su travesaño es la aguja.
  Amarillo de seguridad `#F5C518` y grafito `#14171B`, en la rejilla de 108 × 108 del icono adaptativo
  de Android (lo visible tras la máscara es el centro 72 × 72).
- `play-store-icon-512.png` — icono para la ficha de Google Play (512 × 512, sin esquinas: las pone Google).

## Dónde se usa

| Recurso | Archivo |
|---|---|
| Icono adaptativo (Android 8+) y temático (13+) | `android/app/src/main/res/drawable/ic_launcher_foreground.xml`, `ic_launcher_monochrome.xml`, color en `values/ic_launcher_background.xml` |
| Icono Android 7 | `android/app/src/main/res/mipmap-*/ic_launcher*.png` (generados) |
| Pantalla de inicio | Android 12+: `values/styles.xml` (`windowSplashScreen*`); anteriores: `drawable/splash.xml` |
| Web | `public/favicon.svg` |
| Dentro de la app | `src/components/AppLogo.vue` |

Si cambia el logo: actualiza el SVG y los vectores de `drawable/`, y regenera los PNG con `npm run icons`.

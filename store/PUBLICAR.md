# Publicar Garage en Google Play

Pasos para la primera publicación (1.0) y para las siguientes versiones.

## 0. Antes de nada: la clave de firma

Cada versión que subes a Play va firmada con la **clave de subida**:

- `C:\Users\shego\.garage-release\upload-keystore.jks` (la clave)
- `C:\Users\shego\.garage-release\keystore.properties` (sus contraseñas; también copiado en `android/keystore.properties`)

**Guarda una copia de los dos archivos fuera del ordenador** (gestor de contraseñas, USB…). No van al repositorio
(`.gitignore`). Si se pierden, Google puede asignar una clave nueva, pero el trámite tarda días.

Con *Firma de aplicaciones de Play* (activada por defecto), Google guarda la clave final de la app; la tuya solo
sirve para demostrar que las subidas son tuyas.

## 1. Política de privacidad (GitHub Pages)

1. En GitHub: repositorio `garage` → **Settings → Pages**.
2. *Source*: **Deploy from a branch**; *Branch*: `main`, carpeta **/docs** → Save.
3. En un par de minutos estará en `https://shgonzals.github.io/garage/privacy.html`.

## 2. Crear la app en Play Console

1. **Nombre de desarrollador** (*Configuración → Página de desarrollador* / al crear la cuenta): **Orbita Labs**.
   Es el "hecho por" que se ve bajo el nombre de la app en la tienda; logo e imagen de cabecera en
   `../orbita-labs/brand/` (`icono-512.png`, `cabecera-google-play-4096x2304.png`).
2. **Crear aplicación**: nombre *Garage · Mantenimiento*, idioma predeterminado *Español (España)*, tipo
   *Aplicación*, *Gratuita* (las compras dentro de la app no cambian esto).
3. **Panel → Configurar la aplicación**, en orden:
   - **Acceso a la app**: todas las funciones disponibles sin restricciones.
   - **Anuncios**: *No, mi aplicación no contiene anuncios*.
   - **Clasificación de contenido**: cuestionario → categoría *Utilidades / Productividad*; todo *No*.
   - **Público objetivo**: 18 años o más (evita los requisitos extra para menores).
   - **Seguridad de los datos**: ver el apartado 4.
   - **Aplicaciones gubernamentales**, **funciones financieras**, **salud**: *No*.
   - **Política de privacidad**: la URL del paso 1.
4. **Ficha principal**: textos e imágenes de `store/listing.md` (añade el inglés en *Traducciones*).

## 3. Producto Garage Pro

1. **Monetizar → Productos → Productos únicos** (*In-app products*) → **Crear producto**.
2. ID del producto: **`garage_pro`** (exactamente este: es el que usa la app y no se puede cambiar después).
3. Nombre: *Garage Pro*. Descripción: *Gastos, temas, vehículos sin límite y widget.*
4. Precio: **1,99 €** (Play convierte al resto de monedas) → **Activar**.

Para probar la compra sin pagar: **Configuración → Pruebas de licencias** → añade tu cuenta de Google. Con ella
las compras son de prueba (tarjeta de test) y se pueden reembolsar desde *Gestión de pedidos*.

## 4. Seguridad de los datos (formulario)

- ¿Recoge o comparte datos de usuario? **No**. Todo se guarda en el dispositivo y no se envía a ningún sitio.
- Los pagos los procesa Google Play (no cuentan como datos recogidos por la app).
- ¿Cifrado en tránsito? No aplica (no hay transmisión).
- ¿Los usuarios pueden pedir que se borren sus datos? Pueden borrarlos ellos mismos en la app o desinstalándola.

## 5. Subir la versión

1. `npm run aab` → `releases/garage-<versión>.aab` (firmado con la clave de subida).
2. **Probar → Pruebas internas → Crear versión** → sube el AAB → añade testers (tu cuenta) → *Publicar*.
3. Instala desde el enlace de pruebas internas y prueba la compra de Garage Pro con la cuenta de pruebas de
   licencias. Es la única forma de probar la compra real: en el emulador y en los APK de depuración Google Play
   no ofrece el producto.
4. Cuentas personales nuevas: Google exige una **prueba cerrada con 12 testers durante 14 días** antes de
   poder publicar en producción. Pásales el enlace de la prueba cerrada a amigos o familia.
5. **Producción → Crear versión** → el mismo AAB (o uno nuevo) → *Enviar a revisión* (suele tardar de horas a
   unos días).

## Siguientes versiones

1. Sube la versión en `package.json` (de ahí salen `versionName` y `versionCode`: 1.2.3 → 10203).
2. Actualiza `CHANGELOG.md`.
3. `npm run aab` y súbelo a la pista que toque (internas → producción).
4. Si cambian las pantallas, `npm run store:shots` regenera las capturas.

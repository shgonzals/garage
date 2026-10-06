/** Lado del cuadrado final. Suficiente para el avatar más grande (ficha del vehículo) en pantallas retina. */
const SIZE = 400;
const QUALITY = 0.82;

/**
 * Recorta la imagen al cuadrado central, la reduce a `SIZE`px y la devuelve como data URL JPEG.
 * Una foto de móvil de varios MB queda en ~30-50 KB, apta para guardarse en SQLite.
 */
export async function toSquareThumbnail(file: Blob, size = SIZE): Promise<string> {
  // `createImageBitmap` respeta la orientación EXIF, así que las fotos verticales no salen giradas.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const target = Math.min(size, side);
    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      target,
      target,
    );
    return canvas.toDataURL('image/jpeg', QUALITY);
  } finally {
    bitmap.close();
  }
}

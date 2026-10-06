import { Capacitor } from '@capacitor/core';

/**
 * Entrega un archivo de texto al usuario.
 * - Web: descarga directa.
 * - Android/iOS: el WebView no descarga enlaces, así que se escribe en la caché y se abre
 *   el menú de compartir del sistema (guardar en Drive/Archivos, enviar por correo…).
 * Devuelve `false` si el usuario cancela el menú de compartir.
 */
export async function saveTextFile(name: string, text: string, mime = 'application/json'): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const { Directory, Encoding, Filesystem } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: name, files: [uri] });
      return true;
    } catch {
      return false; // cancelado
    }
  }

  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

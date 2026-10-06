import { Capacitor } from '@capacitor/core';

/**
 * Abre el enlace fuera de la app. En Android/iOS, navegar a un dominio externo lo intercepta
 * Capacitor y lo abre con el sistema (la app de Google Calendar si está instalada); en web,
 * pestaña nueva para no salir de Garage.
 */
export function openExternal(url: string) {
  if (Capacitor.isNativePlatform()) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}

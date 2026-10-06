import { Capacitor, registerPlugin } from '@capacitor/core';
import type { WidgetPayload } from '@/domain/widget';

/**
 * Puente con el widget de Android (plugin nativo `GarageWidget`, en android/app/src/main/java).
 * La app le pasa lo que tiene que pintar; el widget lo guarda y se redibuja.
 */
interface GarageWidgetPlugin {
  update(options: { data: string }): Promise<void>;
}

const GarageWidget = registerPlugin<GarageWidgetPlugin>('GarageWidget');

export const widgetSupported = Capacitor.getPlatform() === 'android';

export async function updateWidget(payload: WidgetPayload): Promise<void> {
  if (!widgetSupported) return;
  await GarageWidget.update({ data: JSON.stringify(payload) });
}

/** Enlaces que abre el widget: `garage://open/log` → `/log`. `null` si no es nuestro. */
export function widgetRoute(url: string): string | null {
  const match = /^garage:\/\/open(\/[^\s]*)$/.exec(url);
  return match ? match[1]! : null;
}

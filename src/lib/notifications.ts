import { Capacitor } from '@capacitor/core';
import { ref, watch } from 'vue';
import type { PlannedAlert } from '@/domain/alerts';

/**
 * Notificaciones locales (@capacitor/local-notifications). Las programa la propia app en el
 * sistema: llegan con la app cerrada y sin conexión, igual que una push, sin servidor.
 * En web no hay forma de avisar con la página cerrada: ahí todo esto no hace nada.
 */
export const alertsSupported = Capacitor.isNativePlatform();

export type AlertPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

const ENABLED_KEY = 'garage-alerts';

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Preferencia del usuario (por defecto, activados). Sin permiso del sistema no llega nada igualmente. */
export const alertsEnabled = ref(loadEnabled());
watch(alertsEnabled, (on) => {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    // sin almacenamiento: la preferencia solo dura esta sesión
  }
});

async function plugin() {
  return (await import('@capacitor/local-notifications')).LocalNotifications;
}

function toPermission(state: string): AlertPermission {
  return state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt';
}

export async function alertPermission(): Promise<AlertPermission> {
  if (!alertsSupported) return 'unsupported';
  return toPermission((await (await plugin()).checkPermissions()).display);
}

/** Pide permiso (Android 13+ e iOS lo exigen). Si ya se denegó, el sistema no vuelve a preguntar. */
export async function requestAlertPermission(): Promise<AlertPermission> {
  if (!alertsSupported) return 'unsupported';
  return toPermission((await (await plugin()).requestPermissions()).display);
}

/** Sustituye todos los avisos pendientes por el plan dado. */
export async function scheduleAlerts(alerts: PlannedAlert[]): Promise<void> {
  if (!alertsSupported) return;
  const ln = await plugin();
  const pending = (await ln.getPending()).notifications;
  if (pending.length > 0) await ln.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
  if (!alertsEnabled.value || alerts.length === 0) return;
  if ((await alertPermission()) !== 'granted') return;
  await ln.schedule({
    notifications: alerts.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      schedule: { at: a.at, allowWhileIdle: true },
      extra: { vehicleId: a.vehicleId },
    })),
  });
}

/** Aviso de prueba a los 5 segundos, para comprobar que llegan. */
export async function sendTestAlert(): Promise<void> {
  if (!alertsSupported) return;
  await (await plugin()).schedule({
    notifications: [
      {
        id: 1,
        title: 'Garage · Aviso de prueba',
        body: 'Así te avisaremos cuando toque un mantenimiento.',
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
      },
    ],
  });
}

/** Al tocar un aviso: devuelve el vehículo al que se refiere. */
export async function onAlertTap(handler: (vehicleId: string) => void): Promise<void> {
  if (!alertsSupported) return;
  await (await plugin()).addListener('localNotificationActionPerformed', (event) => {
    const id = event.notification.extra?.vehicleId;
    if (typeof id === 'string') handler(id);
  });
}

import { Capacitor } from '@capacitor/core';
// Import estático: un plugin de Capacitor no puede devolverse desde una función async
// (el `await` llama a su `.then()`, que el proxy nativo no implementa).
import { LocalNotifications } from '@capacitor/local-notifications';
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


function toPermission(state: string): AlertPermission {
  return state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt';
}

export async function alertPermission(): Promise<AlertPermission> {
  if (!alertsSupported) return 'unsupported';
  return toPermission((await LocalNotifications.checkPermissions()).display);
}

const ASKED_KEY = 'garage-alerts-asked';

/**
 * Pide el permiso una única vez y en el momento en que tiene sentido (cuando ya hay algo que
 * avisar), no al abrir la app por primera vez. Después, solo desde Ajustes.
 */
export async function requestAlertPermissionOnce(): Promise<void> {
  if (!alertsSupported || !alertsEnabled.value) return;
  try {
    if (localStorage.getItem(ASKED_KEY)) return;
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    return;
  }
  if ((await alertPermission()) === 'prompt') await requestAlertPermission();
}

/** Pide permiso (Android 13+ e iOS lo exigen). Si ya se denegó, el sistema no vuelve a preguntar. */
export async function requestAlertPermission(): Promise<AlertPermission> {
  if (!alertsSupported) return 'unsupported';
  return toPermission((await LocalNotifications.requestPermissions()).display);
}

let queue: Promise<void> = Promise.resolve();

/**
 * Sustituye todos los avisos pendientes por el plan dado. Las llamadas se encadenan: si dos
 * se solaparan, una podría cancelar lo que la otra acaba de programar.
 */
export function scheduleAlerts(alerts: PlannedAlert[]): Promise<void> {
  const run = queue.then(() => replaceAlerts(alerts));
  queue = run.catch(() => {});
  return run;
}

async function replaceAlerts(alerts: PlannedAlert[]): Promise<void> {
  if (!alertsSupported) return;
  const ln = LocalNotifications;
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
  await LocalNotifications.schedule({
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
  await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const id = event.notification.extra?.vehicleId;
    if (typeof id === 'string') handler(id);
  });
}

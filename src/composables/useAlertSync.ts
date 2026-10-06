import { App as CapApp } from '@capacitor/app';
import { onScopeDispose, watch } from 'vue';
import { useRouter } from 'vue-router';
import { planAlerts, type PlannedAlert } from '@/domain/alerts';
import { alertsEnabled, alertsSupported, onAlertTap, scheduleAlerts } from '@/lib/notifications';
import { useGarageStore } from '@/stores/garage';

/** Plan de avisos con los datos actuales del store (también sirve de vista previa en Ajustes). */
export function currentAlertPlan(store: ReturnType<typeof useGarageStore>, now = new Date()): PlannedAlert[] {
  return planAlerts(
    store.vehicles.map((vehicle) => ({
      vehicle,
      reminders: store.remindersByVehicle.get(vehicle.id) ?? [],
      rate: store.kmRates.get(vehicle.id) ?? null,
      lastReadingDate: store.readingsByVehicle.get(vehicle.id)?.at(-1)?.read_on ?? null,
    })),
    { now },
  );
}

/**
 * Mantiene los avisos programados al día: tras cada cambio de datos (con un pequeño margen
 * para agrupar cambios seguidos), al activar/desactivar los avisos y al volver a la app,
 * que es cuando cambia "hoy". Al tocar un aviso, abre el vehículo.
 */
export function useAlertSync() {
  if (!alertsSupported) return;
  const store = useGarageStore();
  const router = useRouter();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const sync = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      scheduleAlerts(currentAlertPlan(store)).catch((err) => console.error('No se pudieron programar los avisos', err));
    }, 1500);
  };

  watch([() => store.allReminders, () => store.kmRates, alertsEnabled], sync, { immediate: true });
  void CapApp.addListener('resume', () => void store.reload());
  void onAlertTap((vehicleId) => router.push(`/vehicles/${vehicleId}`));
  onScopeDispose(() => clearTimeout(timer));
}

import { t } from '@/i18n';
import { STATUS_TONE } from '@/components/status';
import { isAnnualDeadline } from './deadlines';
import { dueText, formatDate, reminderHeadline } from './format';
import type { Reminder } from './reminders';
import { getTask } from './tasks';
import type { Vehicle } from './types';

/**
 * Lo que muestra el widget de Android: las tareas más urgentes de todos los vehículos.
 *
 * Los textos llegan ya traducidos (el widget no sabe nada de la app). Van en forma absoluta
 * ("Toca antes del 14 mar 2027", no "En 5 días") porque el widget solo se refresca cuando se abre
 * la app: una cuenta atrás se quedaría desfasada.
 */
export interface WidgetItem {
  vehicleId: string;
  title: string;
  subtitle: string;
  tone: 'danger' | 'warning' | 'success' | 'neutral';
}

export interface WidgetPayload {
  /** Texto del botón de registro rápido; vacío lo oculta. */
  quickLog: string;
  empty: string;
  items: WidgetItem[];
  /** Ruta al tocar el widget fuera de las filas y del botón. */
  open: string;
}

export const WIDGET_ROWS = 3;

function subtitle(r: Reminder): string {
  if (r.status === 'overdue') return reminderHeadline(r);
  if (isAnnualDeadline(r.taskId) && r.dueDate) return t('widget.expires', { date: formatDate(r.dueDate) });
  return t('widget.due', { target: dueText(r) });
}

/** `reminders`: todos los recordatorios, ya ordenados por urgencia (como `store.allReminders`). */
export function widgetPayload(vehicles: readonly Vehicle[], reminders: readonly Reminder[], pro = true): WidgetPayload {
  // El widget es de Garage Pro: sin él, solo invita a desbloquearlo.
  if (!pro) return { quickLog: '', empty: t('widget.locked'), items: [], open: '/pro?from=widget' };
  const names = new Map(vehicles.map((v) => [v.id, v.name]));
  // Lo pospuesto y lo que no tiene historial no es "lo próximo": se queda en la app.
  const items = reminders
    .filter((r) => names.has(r.vehicleId) && (r.status === 'overdue' || r.status === 'soon' || r.status === 'ok'))
    .slice(0, WIDGET_ROWS)
    .map((r) => ({
      vehicleId: r.vehicleId,
      title: `${names.get(r.vehicleId)} · ${getTask(r.taskId).label}`,
      subtitle: subtitle(r),
      tone: STATUS_TONE[r.status],
    }));
  return {
    quickLog: t('widget.quickLog'),
    empty: vehicles.length === 0 ? t('widget.noVehicles') : t('widget.allGood'),
    items,
    open: '/tabs/reminders',
  };
}

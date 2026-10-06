import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Reminder, VehicleSummary } from './reminders';
import { getTask, YEAR } from './tasks';
import type { IsoDate } from './types';

// `useGrouping: 'always'` para que 8410 se muestre "8.410" (es-ES no agrupa 4 cifras por defecto).
const kmFormat = new Intl.NumberFormat('es-ES', {
  useGrouping: 'always' as unknown as boolean, // tipos de TS aún sin Intl.NumberFormat v3
  maximumFractionDigits: 0,
});

export function formatNumber(n: number): string {
  return kmFormat.format(n);
}

export function formatKm(km: number): string {
  return `${formatNumber(km)} km`;
}

/** `2026-10-02` → `2 oct 2026` */
export function formatDate(iso: IsoDate): string {
  return format(parseISO(iso), 'd MMM yyyy', { locale: es }).replace('.', '');
}

/** `2026-08-18` → `18 ago` */
export function formatShortDate(iso: IsoDate): string {
  return format(parseISO(iso), 'd MMM', { locale: es }).replace('.', '');
}

export function formatMoney(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(cents / 100);
}

function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/** `730` → `2 años`; si no son años exactos, en días. */
function formatInterval(days: number): string {
  return days % YEAR === 0 ? plural(days / YEAR, 'año', 'años') : plural(days, 'día', 'días');
}

/** Línea principal del recordatorio, p. ej. `1.150 km · Toca a 24.200 km o antes del 14 mar 2027`. */
export function reminderHeadline(r: Reminder): string {
  if (r.status === 'unknown') {
    const parts = [
      r.intervalKm ? `cada ${formatKm(r.intervalKm)}` : null,
      r.intervalDays ? `cada ${formatInterval(r.intervalDays)}` : null,
    ].filter(Boolean);
    return r.taskId === 'itv'
      ? 'Registra tu última ITV para calcular la siguiente'
      : `Sin registro previo · ${parts.join(' o ')}`;
  }

  const target = [
    r.dueKm !== null ? `a ${formatNumber(r.dueKm)} km` : null,
    r.dueDate !== null ? `${r.dueKm !== null ? 'o antes del' : 'antes del'} ${formatDate(r.dueDate)}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  if (r.status === 'overdue') {
    if (r.trigger === 'km' && r.remainingKm !== null && r.remainingKm < 0) {
      return `+${formatKm(-r.remainingKm)} · Tocaba a ${formatNumber(r.dueKm!)} km`;
    }
    return `Vencido · Tocaba el ${formatDate(r.dueDate!)}`;
  }

  const lead =
    r.trigger === 'km' && r.remainingKm !== null
      ? formatKm(r.remainingKm)
      : r.remainingDays !== null
        ? r.remainingDays === 0
          ? 'Hoy'
          : `En ${plural(r.remainingDays, 'día', 'días')}`
        : '';
  return `${lead} · Toca ${target}`;
}

/** `Último: 18.200 km, 14 mar 2026` */
export function reminderLastLine(r: Reminder): string | null {
  if (!r.last) return null;
  return r.last.km !== null
    ? `Último: ${formatKm(r.last.km)}, ${formatDate(r.last.date)}`
    : `Último: ${formatDate(r.last.date)}`;
}

/** Texto corto para la tarjeta del vehículo en "Mi garage". */
export function summaryText(s: VehicleSummary): string {
  if (s.overdue > 0) return s.overdue === 1 ? '1 vencido' : `${s.overdue} vencidos`;
  const top = s.top;
  if (!top) return 'Sin recordatorios';
  if (top.status === 'soon') {
    const label = getTask(top.taskId).label;
    if (top.trigger === 'km' && top.remainingKm !== null) return `${label} en ${formatKm(top.remainingKm)}`;
    if (top.remainingDays !== null) {
      return top.remainingDays === 0 ? `${label} hoy` : `${label} en ${plural(top.remainingDays, 'día', 'días')}`;
    }
  }
  if (top.status === 'ok') return 'Al día';
  return 'Sin historial';
}

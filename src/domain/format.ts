import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Reminder, VehicleSummary } from './reminders';
import { isAnnualDeadline } from './deadlines';
import { getTask, YEAR } from './tasks';
import type { UsageUnit } from './units';
import type { IsoDate } from './types';

// `useGrouping: 'always'` para que 8410 se muestre "8.410" (es-ES no agrupa 4 cifras por defecto).
const kmFormat = new Intl.NumberFormat('es-ES', {
  useGrouping: 'always' as unknown as boolean, // tipos de TS aún sin Intl.NumberFormat v3
  maximumFractionDigits: 0,
});

/** 3250 cL → "32,5 L". */
export function formatLiters(centiliters: number): string {
  return `${(centiliters / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })} L`;
}

export function formatNumber(n: number): string {
  return kmFormat.format(n);
}

export function formatKm(km: number): string {
  return `${formatNumber(km)} km`;
}

/** `23.050 km`, `45 h`: cifra de uso en la unidad del vehículo. */
export function formatUsage(value: number, unit: UsageUnit): string {
  return `${formatNumber(value)} ${unit}`;
}

/** Ritmo de uso: `17 km/día`, `2,5 h/semana` (las horas por día son cifras demasiado pequeñas). */
export function formatRate(perDay: number, unit: UsageUnit): string {
  if (unit === 'km') return `${formatNumber(Math.round(perDay))} km/día`;
  return `${(Math.round(perDay * 7 * 10) / 10).toString().replace('.', ',')} h/semana`;
}

/** `2026-10-02` → `2 oct 2026` */
export function formatDate(iso: IsoDate): string {
  return format(parseISO(iso), 'd MMM yyyy', { locale: es }).replace('.', '');
}

/** `2026-08-18` → `18/08/26` (tabla de partes de trabajo) */
export function formatNumericDate(iso: IsoDate): string {
  return format(parseISO(iso), 'dd/MM/yy');
}

/** Momento de un aviso: `11 oct · 10:00` */
export function formatDayTime(date: Date): string {
  return format(date, "d MMM '·' HH:mm", { locale: es }).replace('.', '');
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

/** `hasta el 13 oct 2026` / `hasta los 24.000 km` */
export function snoozeUntilText(until: { date: IsoDate | null; km: number | null }, unit: UsageUnit = 'km'): string {
  if (until.date) return `hasta el ${formatDate(until.date)}`;
  return unit === 'km' ? `hasta los ${formatNumber(until.km ?? 0)} km` : `hasta las ${formatNumber(until.km ?? 0)} h`;
}

/** Límite de un recordatorio: `a 24.200 km o antes del 14 mar 2027`. */
export function dueText(r: Reminder): string {
  return [
    r.dueKm !== null ? `a ${formatUsage(r.dueKm, r.unit)}` : null,
    r.dueDate !== null ? `${r.dueKm !== null ? 'o antes del' : 'antes del'} ${formatDate(r.dueDate)}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Línea principal del recordatorio, p. ej. `1.150 km · Toca a 24.200 km o antes del 14 mar 2027`. */
export function reminderHeadline(r: Reminder): string {
  if (r.status === 'snoozed' && r.snoozedUntil) return `Pospuesto ${snoozeUntilText(r.snoozedUntil, r.unit)}`;
  if (r.status === 'unknown') {
    const parts = [
      r.intervalKm ? `cada ${formatUsage(r.intervalKm, r.unit)}` : null,
      r.intervalDays ? `cada ${formatInterval(r.intervalDays)}` : null,
    ].filter(Boolean);
    return r.taskId === 'itv'
      ? 'Registra tu última ITV para calcular la siguiente'
      : `Sin registro previo · ${parts.join(' o ')}`;
  }

  const target = dueText(r);

  if (r.status === 'overdue') {
    if (r.trigger === 'km' && r.remainingKm !== null && r.remainingKm < 0) {
      return `+${formatUsage(-r.remainingKm, r.unit)} · Tocaba a ${formatUsage(r.dueKm!, r.unit)}`;
    }
    if (isAnnualDeadline(r.taskId)) return `Vencido el ${formatDate(r.dueDate!)}`;
    return `Vencido · Tocaba el ${formatDate(r.dueDate!)}`;
  }

  const lead =
    r.trigger === 'km' && r.remainingKm !== null
      ? formatUsage(r.remainingKm, r.unit)
      : r.remainingDays !== null
        ? r.remainingDays === 0
          ? 'Hoy'
          : `En ${plural(r.remainingDays, 'día', 'días')}`
        : '';
  // Seguro e impuesto no "tocan": vencen.
  if (isAnnualDeadline(r.taskId) && r.dueDate) return `${lead} · Vence el ${formatDate(r.dueDate)}`;
  return `${lead} · Toca ${target}`;
}

/** `Último: 18.200 km, 14 mar 2026` */
export function reminderLastLine(r: Reminder): string | null {
  if (!r.last) return null;
  return r.last.km !== null
    ? `Último: ${formatUsage(r.last.km, r.unit)}, ${formatDate(r.last.date)}`
    : `Último: ${formatDate(r.last.date)}`;
}

/** Texto corto para la tarjeta del vehículo en "Mi garage". */
export function summaryText(s: VehicleSummary): string {
  if (s.overdue > 0) return s.overdue === 1 ? '1 vencido' : `${s.overdue} vencidos`;
  if (s.top?.status === 'snoozed') return `${getTask(s.top.taskId).label}: pospuesto`;
  const top = s.top;
  if (!top) return 'Sin recordatorios';
  if (top.status === 'soon') {
    const label = getTask(top.taskId).label;
    if (top.trigger === 'km' && top.remainingKm !== null) return `${label} en ${formatUsage(top.remainingKm, top.unit)}`;
    if (top.remainingDays !== null) {
      return top.remainingDays === 0 ? `${label} hoy` : `${label} en ${plural(top.remainingDays, 'día', 'días')}`;
    }
  }
  if (top.status === 'ok') return 'Al día';
  return 'Sin historial';
}

/**
 * Cifra del indicador circular: lo que queda (o lo que ya se ha pasado, con "+") en la
 * dimensión que manda, y cuánto del intervalo se ha consumido (0–1) para el arco.
 */
export function reminderGauge(r: Reminder): { value: string; unit: string; fill: number } {
  if (r.status === 'unknown') return { value: '—', unit: '', fill: 0 };
  // En el círculo caben ~5 caracteres: a partir de 10.000, en miles ("103k"). El texto de la tarjeta da la cifra exacta.
  const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : formatNumber(n));
  const days = (n: number) => (n === 1 ? 'día' : 'días');
  if (r.status === 'overdue' || r.status === 'snoozed') {
    if (r.remainingKm !== null && r.remainingKm < 0) return { value: `+${compact(-r.remainingKm)}`, unit: r.unit, fill: 1 };
    if (r.remainingDays !== null && r.remainingDays < 0) {
      return { value: `+${compact(-r.remainingDays)}`, unit: days(-r.remainingDays), fill: 1 };
    }
  }
  const fill = Math.min(Math.max(r.progress, 0), 1);
  if (r.trigger === 'km' && r.remainingKm !== null) return { value: compact(r.remainingKm), unit: r.unit, fill };
  if (r.remainingDays !== null) return { value: compact(r.remainingDays), unit: days(r.remainingDays), fill };
  return { value: '—', unit: '', fill };
}

/** Línea del cuadro de la ficha: `Engrase de cadena en 150 km`, `Líquido de frenos · +5 días`. */
export function nextServiceText(r: Reminder): string {
  const label = getTask(r.taskId).label;
  const g = reminderGauge(r);
  if (r.status === 'overdue') return `${label} · ${g.value} ${g.unit}`;
  if (r.trigger !== 'km' && r.remainingDays === 0) return `${label} hoy`;
  return `${label} en ${g.value} ${g.unit}`;
}

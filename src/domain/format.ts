import { format, parseISO } from 'date-fns';
import { dateLocale, intlLocale, t } from '@/i18n';
import type { Reminder, VehicleSummary } from './reminders';
import { isAnnualDeadline } from './deadlines';
import { getTask, YEAR } from './tasks';
import type { UsageUnit } from './units';
import type { IsoDate } from './types';

// `useGrouping: 'always'` para que 8410 se muestre "8.410" (es-ES no agrupa 4 cifras por defecto).
const numberFormats = new Map<string, Intl.NumberFormat>();
function numberFormat(): Intl.NumberFormat {
  const locale = intlLocale();
  let f = numberFormats.get(locale);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      useGrouping: 'always' as unknown as boolean, // tipos de TS aún sin Intl.NumberFormat v3
      maximumFractionDigits: 0,
    });
    numberFormats.set(locale, f);
  }
  return f;
}

/** Locale de `Intl` para formatear cifras fuera de este módulo. */
export const intlNumberLocale = intlLocale;

/** Decimal en el idioma actual: `2,5` / `2.5`. */
export function formatDecimal(n: number, digits = 1, minDigits = 0): string {
  return n.toLocaleString(intlLocale(), { minimumFractionDigits: minDigits, maximumFractionDigits: digits });
}

/**
 * Cifra escrita a mano, en cualquiera de los dos idiomas: "1.234,50" o "65,5" (es) y "1,234.50" o
 * "65.5" (en). El último separador que aparece es el decimal; el otro, de miles.
 */
export function parseDecimal(text: string | number | null | undefined): number | null {
  let s = String(text ?? '').trim();
  if (s === '') return null;
  const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
  const thousands = decimal === ',' ? '.' : ',';
  s = s.split(thousands).join('').replace(decimal, '.');
  return Number(s);
}

/** 3250 cL → "32,5 L". */
export function formatLiters(centiliters: number): string {
  return `${formatDecimal(centiliters / 100, 2)} L`;
}

export function formatNumber(n: number): string {
  return numberFormat().format(n);
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
  if (unit === 'km') return t('format.perDayKm', { n: formatNumber(Math.round(perDay)) });
  return t('format.perWeekH', { n: formatDecimal(perDay * 7) });
}

/** `2026-10-02` → `2 oct 2026` */
export function formatDate(iso: IsoDate): string {
  return format(parseISO(iso), 'd MMM yyyy', { locale: dateLocale() }).replace('.', '');
}

/** `2026-08-18` → `18/08/26` (tabla de partes de trabajo) */
export function formatNumericDate(iso: IsoDate): string {
  return format(parseISO(iso), 'dd/MM/yy');
}

/** Momento de un aviso: `11 oct · 10:00` */
export function formatDayTime(date: Date): string {
  return format(date, "d MMM '·' HH:mm", { locale: dateLocale() }).replace('.', '');
}

/** `2026-08-18` → `18 ago` */
export function formatShortDate(iso: IsoDate): string {
  return format(parseISO(iso), 'd MMM', { locale: dateLocale() }).replace('.', '');
}

/** `0` → `Enero` / `January`. */
export function monthName(month: number): string {
  const name = format(new Date(2000, month, 1), 'LLLL', { locale: dateLocale() });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function formatMoney(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(intlLocale(), { style: 'currency', currency }).format(cents / 100);
}

const days = (n: number) => t('format.days', { n: formatNumber(n) }, n);

/** `730` → `2 años`; si no son años exactos, en días. */
function formatInterval(d: number): string {
  return d % YEAR === 0 ? t('format.years', { n: formatNumber(d / YEAR) }, d / YEAR) : days(d);
}

/** `hasta el 13 oct 2026` / `hasta los 24.000 km` */
export function snoozeUntilText(until: { date: IsoDate | null; km: number | null }, unit: UsageUnit = 'km'): string {
  if (until.date) return t('format.untilDate', { date: formatDate(until.date) });
  const n = formatNumber(until.km ?? 0);
  return unit === 'km' ? t('format.untilKm', { n }) : t('format.untilH', { n });
}

/** Límite de un recordatorio: `a 24.200 km o antes del 14 mar 2027`. */
export function dueText(r: Reminder): string {
  return [
    r.dueKm !== null ? t('format.dueAt', { value: formatUsage(r.dueKm, r.unit) }) : null,
    r.dueDate !== null
      ? t(r.dueKm !== null ? 'format.orBefore' : 'format.before', { date: formatDate(r.dueDate) })
      : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Línea principal del recordatorio, p. ej. `1.150 km · Toca a 24.200 km o antes del 14 mar 2027`. */
export function reminderHeadline(r: Reminder): string {
  if (r.status === 'snoozed' && r.snoozedUntil) {
    return t('format.snoozed', { until: snoozeUntilText(r.snoozedUntil, r.unit) });
  }
  if (r.status === 'unknown') {
    const parts = [
      r.intervalKm ? t('format.every', { interval: formatUsage(r.intervalKm, r.unit) }) : null,
      r.intervalDays ? t('format.every', { interval: formatInterval(r.intervalDays) }) : null,
    ].filter(Boolean);
    return r.taskId === 'itv'
      ? t('format.itvUnknown')
      : t('format.noHistory', { intervals: parts.join(t('format.or')) });
  }

  const target = dueText(r);

  if (r.status === 'overdue') {
    if (r.trigger === 'km' && r.remainingKm !== null && r.remainingKm < 0) {
      return t('format.overdueBy', { over: formatUsage(-r.remainingKm, r.unit), due: formatUsage(r.dueKm!, r.unit) });
    }
    if (isAnnualDeadline(r.taskId)) return t('format.expiredOn', { date: formatDate(r.dueDate!) });
    return t('format.overdueOn', { date: formatDate(r.dueDate!) });
  }

  const lead =
    r.trigger === 'km' && r.remainingKm !== null
      ? formatUsage(r.remainingKm, r.unit)
      : r.remainingDays !== null
        ? r.remainingDays === 0
          ? t('format.today')
          : t('format.inDays', { days: days(r.remainingDays) })
        : '';
  // Seguro e impuesto no "tocan": vencen.
  if (isAnnualDeadline(r.taskId) && r.dueDate) return t('format.expiresOn', { lead, date: formatDate(r.dueDate) });
  return t('format.due', { lead, target });
}

/** `Último: 18.200 km, 14 mar 2026` */
export function reminderLastLine(r: Reminder): string | null {
  if (!r.last) return null;
  return r.last.km !== null
    ? t('format.lastWithKm', { value: formatUsage(r.last.km, r.unit), date: formatDate(r.last.date) })
    : t('format.last', { date: formatDate(r.last.date) });
}

/** Texto corto para la tarjeta del vehículo en "Mi garage". */
export function summaryText(s: VehicleSummary): string {
  if (s.overdue > 0) return t('format.overdueCount', { n: s.overdue }, s.overdue);
  if (s.top?.status === 'snoozed') return t('format.taskSnoozed', { task: getTask(s.top.taskId).label });
  const top = s.top;
  if (!top) return t('format.noReminders');
  if (top.status === 'soon') {
    const task = getTask(top.taskId).label;
    if (top.trigger === 'km' && top.remainingKm !== null) {
      return t('format.taskIn', { task, when: formatUsage(top.remainingKm, top.unit) });
    }
    if (top.remainingDays !== null) {
      return top.remainingDays === 0
        ? t('format.taskToday', { task })
        : t('format.taskIn', { task, when: days(top.remainingDays) });
    }
  }
  if (top.status === 'ok') return t('format.upToDate');
  return t('format.noHistoryShort');
}

/**
 * Cifra del indicador circular: lo que queda (o lo que ya se ha pasado, con "+") en la
 * dimensión que manda, y cuánto del intervalo se ha consumido (0–1) para el arco.
 */
export function reminderGauge(r: Reminder): { value: string; unit: string; fill: number } {
  if (r.status === 'unknown') return { value: '—', unit: '', fill: 0 };
  // En el círculo caben ~5 caracteres: a partir de 10.000, en miles ("103k"). El texto de la tarjeta da la cifra exacta.
  const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : formatNumber(n));
  const dayUnit = (n: number) => t('format.dayUnit', n);
  if (r.status === 'overdue' || r.status === 'snoozed') {
    if (r.remainingKm !== null && r.remainingKm < 0) return { value: `+${compact(-r.remainingKm)}`, unit: r.unit, fill: 1 };
    if (r.remainingDays !== null && r.remainingDays < 0) {
      return { value: `+${compact(-r.remainingDays)}`, unit: dayUnit(-r.remainingDays), fill: 1 };
    }
  }
  const fill = Math.min(Math.max(r.progress, 0), 1);
  if (r.trigger === 'km' && r.remainingKm !== null) return { value: compact(r.remainingKm), unit: r.unit, fill };
  if (r.remainingDays !== null) return { value: compact(r.remainingDays), unit: dayUnit(r.remainingDays), fill };
  return { value: '—', unit: '', fill };
}

/** Línea del cuadro de la ficha: `Engrase de cadena en 150 km`, `Líquido de frenos · +5 días`. */
export function nextServiceText(r: Reminder): string {
  const label = getTask(r.taskId).label;
  const g = reminderGauge(r);
  if (r.status === 'overdue') return `${label} · ${g.value} ${g.unit}`;
  if (r.trigger !== 'km' && r.remainingDays === 0) return t('format.taskToday', { task: label });
  return t('format.taskIn', { task: label, when: `${g.value} ${g.unit}` });
}

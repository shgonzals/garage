import { addDays, differenceInCalendarDays, parseISO, subDays } from 'date-fns';
import { toIsoDate } from './dates';
import { suspiciousReadings } from './odometer';
import type { Reminder } from './reminders';
import type { IsoDate, OdometerReading } from './types';

type Reading = Pick<OdometerReading, 'id' | 'km' | 'read_on'>;

/** Por debajo de este tramo entre lecturas, el ritmo sale demasiado ruidoso. */
const MIN_SPAN_DAYS = 14;
/** Solo cuenta el último año: el ritmo de hace tres veranos no dice mucho. */
const WINDOW_DAYS = 365;

export interface KmRate {
  /** Km por día. */
  perDay: number;
  /** Fecha y km de la última lectura: punto de partida de las estimaciones. */
  lastDate: IsoDate;
  lastKm: number;
}

/**
 * Ritmo de uso de un vehículo a partir de sus lecturas: (km última − km primera) / días,
 * dentro del último año y sin las lecturas que parecen errores al teclear.
 * `null` si no hay datos suficientes (menos de dos lecturas separadas por 14 días).
 */
export function estimateKmRate(readings: readonly Reading[]): KmRate | null {
  const bad = suspiciousReadings(readings);
  const valid = readings
    .filter((r) => !bad.has(r.id))
    .sort((a, b) => a.read_on.localeCompare(b.read_on) || a.km - b.km);
  const last = valid.at(-1);
  if (!last) return null;

  const from = toIsoDate(subDays(parseISO(last.read_on), WINDOW_DAYS));
  const first = valid.find((r) => r.read_on >= from);
  if (!first) return null;
  const days = differenceInCalendarDays(parseISO(last.read_on), parseISO(first.read_on));
  if (days < MIN_SPAN_DAYS) return null;

  const perDay = (last.km - first.km) / days;
  return perDay > 0 ? { perDay, lastDate: last.read_on, lastKm: last.km } : null;
}

/** Fecha estimada en la que el vehículo llegará a `targetKm` a su ritmo (nunca antes de hoy). */
export function dateForKm(rate: KmRate, targetKm: number, today: IsoDate): IsoDate {
  const days = Math.ceil((targetKm - rate.lastKm) / rate.perDay);
  const date = toIsoDate(addDays(parseISO(rate.lastDate), Math.max(days, 0)));
  return date < today ? today : date;
}

/**
 * Cuándo tocará un recordatorio por km según el ritmo. Solo se devuelve si adelanta a la
 * fecha límite (si la fecha llega antes, ya manda la fecha y no hace falta estimar nada).
 */
export function estimatedKmDueDate(r: Reminder, rate: KmRate | null, today: IsoDate): IsoDate | null {
  if (!rate || r.dueKm === null || r.status === 'overdue' || r.status === 'unknown') return null;
  const date = dateForKm(rate, r.dueKm, today);
  return r.dueDate !== null && r.dueDate <= date ? null : date;
}

import { addDays, differenceInCalendarDays, isSaturday, isSunday, nextSaturday, nextSunday, parseISO, set, subDays } from 'date-fns';
import { toIsoDate } from './dates';
import type { KmRate } from './forecast';
import { isAnnualDeadline } from './deadlines';
import { dueText, formatDate, formatNumber } from './format';
import { soonThresholdDays, soonThresholdKm, type Reminder } from './reminders';
import { getTask } from './tasks';
import type { IsoDate, Vehicle } from './types';

/**
 * Plan de avisos (notificaciones locales). Función pura: se recalcula entero cada vez que
 * cambian los datos y se reprograma todo, así nunca queda un aviso obsoleto.
 *
 * - "Se acerca": cuando una tarea al día pasa a "pronto" (por fecha, o por km a tu ritmo).
 * - "Toca": el día en que vence (por fecha, o cuando a tu ritmo llegues a los km).
 * - Vencidos: un resumen semanal por vehículo (sábado), no un aviso diario que acabe ignorado.
 * - Odómetro: si llevas 3 semanas sin apuntar km y hay tareas por km, te los pide.
 */

export type AlertKind = 'soon' | 'due' | 'overdue' | 'odometer';

export interface PlannedAlert {
  /** Estable por vehículo + tarea + tipo: reprogramar sustituye en lugar de duplicar. */
  id: number;
  kind: AlertKind;
  at: Date;
  title: string;
  body: string;
  vehicleId: string;
}

export interface AlertVehicle {
  vehicle: Vehicle;
  reminders: Reminder[];
  rate: KmRate | null;
  lastReadingDate: IsoDate | null;
}

export interface AlertOptions {
  now: Date;
  /** Hora local de los avisos de mantenimiento. */
  hour?: number;
  /** Solo se programa lo que cae en este margen (se reprograma al abrir la app). */
  horizonDays?: number;
  /** iOS admite 64 avisos pendientes por app: se deja margen. */
  max?: number;
}

const ODOMETER_STALE_DAYS = 21;
const ODOMETER_HOUR = 19;

export function planAlerts(vehicles: AlertVehicle[], opts: AlertOptions): PlannedAlert[] {
  const { now, hour = 10, horizonDays = 90, max = 60 } = opts;
  const today = toIsoDate(now);
  const horizon = addDays(now, horizonDays);
  const out: PlannedAlert[] = [];
  const add = (a: Omit<PlannedAlert, 'id'> & { key: string }) => {
    if (a.at <= now || a.at > horizon) return;
    const { key, ...alert } = a;
    out.push({ ...alert, id: alertId(key) });
  };

  for (const { vehicle, reminders, rate, lastReadingDate } of vehicles) {
    const name = vehicle.name;

    for (const r of reminders) {
      if (r.status !== 'ok' && r.status !== 'soon') continue;
      const label = getTask(r.taskId).label;
      const kmDue = rate && r.dueKm !== null ? rawDateForKm(rate, r.dueKm) : null;
      const due = earliest(r.dueDate, kmDue);
      if (!due) continue;
      const dueByKm = due === kmDue && kmDue !== r.dueDate;

      if (r.status === 'ok') {
        const soonByDate = r.dueDate && r.intervalDays ? shiftDays(r.dueDate, -Math.ceil(soonThresholdDays(r.intervalDays))) : null;
        const soonByKm =
          rate && r.dueKm !== null && r.intervalKm ? rawDateForKm(rate, r.dueKm - soonThresholdKm(r.intervalKm)) : null;
        const soon = earliest(soonByDate, soonByKm);
        if (soon && soon >= today && soon < due) {
          add({
            key: `soon:${vehicle.id}:${r.taskId}`,
            kind: 'soon',
            at: atHour(soon, hour),
            title: `${name} · ${label}`,
            body: isAnnualDeadline(r.taskId) ? `Vence el ${formatDate(r.dueDate!)}.` : `Se acerca: toca ${dueText(r)}.`,
            vehicleId: vehicle.id,
          });
        }
      }

      // Una fecha estimada ya pasada no se avisa a diario: de eso se encarga el aviso de odómetro.
      if (due < today) continue;
      add({
        key: `due:${vehicle.id}:${r.taskId}`,
        kind: 'due',
        at: atHour(due, hour),
        title: `${name} · ${label}`,
        body: dueByKm
          ? `A tu ritmo ya rondarás los ${formatNumber(r.dueKm!)} km: toca hacerlo.`
          : isAnnualDeadline(r.taskId)
            ? 'Vence hoy. Cuando lo renueves, apúntalo en Garage.'
            : `Toca hoy (${dueText(r)}).`,
        vehicleId: vehicle.id,
      });
    }

    const overdue = reminders.filter((r) => r.status === 'overdue');
    if (overdue.length > 0) {
      add({
        key: `overdue:${vehicle.id}`,
        kind: 'overdue',
        at: weekly(now, hour, isSaturday, nextSaturday),
        title: `${name} · ${overdue.length} ${overdue.length === 1 ? 'mantenimiento vencido' : 'mantenimientos vencidos'}`,
        body: overdue.map((r) => getTask(r.taskId).label).join(', '),
        vehicleId: vehicle.id,
      });
    }

    const usesKm = reminders.some((r) => r.intervalKm !== null);
    if (usesKm && lastReadingDate) {
      let at = atHour(shiftDays(lastReadingDate, ODOMETER_STALE_DAYS), ODOMETER_HOUR);
      if (at <= now) at = weekly(now, ODOMETER_HOUR, isSunday, nextSunday);
      const days = differenceInCalendarDays(at, parseISO(lastReadingDate));
      add({
        key: `odometer:${vehicle.id}`,
        kind: 'odometer',
        at,
        title: `${name} · ¿Cuántos km tiene?`,
        body: `Hace ${days} días que no apuntas los km. Actualízalos para que los avisos por km sean fiables.`,
        vehicleId: vehicle.id,
      });
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, max);
}

/** Como `dateForKm` pero sin limitar a hoy: aquí importa saber si la estimación ya pasó. */
function rawDateForKm(rate: KmRate, targetKm: number): IsoDate {
  return shiftDays(rate.lastDate, Math.ceil((targetKm - rate.lastKm) / rate.perDay));
}

function shiftDays(date: IsoDate, days: number): IsoDate {
  return toIsoDate(days >= 0 ? addDays(parseISO(date), days) : subDays(parseISO(date), -days));
}

function earliest(...dates: (IsoDate | null)[]): IsoDate | null {
  const valid = dates.filter((d): d is IsoDate => d !== null).sort();
  return valid[0] ?? null;
}

function atHour(date: IsoDate, hour: number): Date {
  return set(parseISO(date), { hours: hour, minutes: 0, seconds: 0, milliseconds: 0 });
}

/** Próximo día de la semana dado a esa hora (hoy mismo si aún no ha pasado la hora). */
function weekly(now: Date, hour: number, isDay: (d: Date) => boolean, next: (d: Date) => Date): Date {
  const todayAt = set(now, { hours: hour, minutes: 0, seconds: 0, milliseconds: 0 });
  if (isDay(now) && todayAt > now) return todayAt;
  return set(next(now), { hours: hour, minutes: 0, seconds: 0, milliseconds: 0 });
}

/** FNV-1a de 31 bits: los ids de notificación en Android son enteros de 32 bits con signo. */
export function alertId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1;
}

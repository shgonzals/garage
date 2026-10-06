import { addDays, addMonths, parseISO } from 'date-fns';
import { toIsoDate } from './dates';
import type { Reminder } from './reminders';
import type { IsoDate, IsoDateTime, TaskId } from './types';
import { UNITS } from './units';

/**
 * Aplazamientos ("recuérdamelo más tarde") de un recordatorio vencido o próximo.
 * Mientras está activo, el recordatorio queda en estado `snoozed`: no cuenta como vencido ni
 * genera avisos. Termina al llegar la fecha o los km, o al registrar la tarea.
 */
export interface Snooze {
  vehicle_id: string;
  task_id: TaskId;
  until_date: IsoDate | null;
  until_km: number | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  deleted_at: IsoDateTime | null;
}

export type SnoozeUntil = { date: IsoDate; km: null } | { date: null; km: number };

export interface SnoozeOption {
  label: string;
  until: SnoozeUntil;
}

/** Opciones del menú "Posponer": por tiempo siempre; por km si la tarea va por km y hay odómetro. */
export function snoozeOptions(r: Reminder, currentKm: number | null, today: IsoDate): SnoozeOption[] {
  const date = (d: Date): SnoozeUntil => ({ date: toIsoDate(d), km: null });
  const t = parseISO(today);
  const options: SnoozeOption[] = [
    { label: '1 semana', until: date(addDays(t, 7)) },
    { label: '2 semanas', until: date(addDays(t, 14)) },
    { label: '1 mes', until: date(addMonths(t, 1)) },
  ];
  if (r.dueKm !== null && currentKm !== null) {
    const fmt = (n: number) => new Intl.NumberFormat('es-ES', { useGrouping: 'always' as unknown as boolean }).format(n);
    for (const step of UNITS[r.unit].snoozeSteps) {
      options.push({ label: `${fmt(step)} ${r.unit} más`, until: { date: null, km: currentKm + step } });
    }
  }
  return options;
}

/** ¿Sigue vigente? Caduca al pasar la fecha o los km, y si la tarea se registró después de aplazarla. */
export function isSnoozeActive(s: Snooze, r: Reminder, currentKm: number | null, today: IsoDate): boolean {
  if (s.deleted_at) return false;
  if (r.last && r.last.date >= s.created_at.slice(0, 10)) return false;
  if (s.until_date !== null) return today < s.until_date;
  if (s.until_km !== null) return currentKm === null || currentKm < s.until_km;
  return false;
}

/** Aplica los aplazamientos vigentes a los recordatorios vencidos o próximos de un vehículo. */
export function applySnoozes(
  reminders: Reminder[],
  snoozes: readonly Snooze[],
  currentKm: number | null,
  today: IsoDate,
): Reminder[] {
  return reminders.map((r) => {
    if (r.status !== 'overdue' && r.status !== 'soon') return r;
    const s = snoozes.find((x) => x.vehicle_id === r.vehicleId && x.task_id === r.taskId);
    if (!s || !isSnoozeActive(s, r, currentKm, today)) return r;
    return { ...r, status: 'snoozed', snoozedUntil: { date: s.until_date, km: s.until_km } };
  });
}

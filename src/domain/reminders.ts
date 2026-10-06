import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { toIsoDate } from './dates';
import { ANNUAL_DEADLINES, DEADLINE_SOON_DAYS, deadlineAnchor, nextAnnualDue } from './deadlines';
import { nextItvDate } from './itv';
import type { EntryWithItems, IsoDate, Schedule, TaskId, Vehicle } from './types';

export type Urgency = 'overdue' | 'soon' | 'ok' | 'unknown';

export interface LastDone {
  date: IsoDate;
  km: number | null;
}

export interface Reminder {
  vehicleId: string;
  taskId: TaskId;
  status: Urgency;
  last: LastDone | null;
  intervalKm: number | null;
  intervalDays: number | null;
  dueKm: number | null;
  dueDate: IsoDate | null;
  /** Negativo = pasado. */
  remainingKm: number | null;
  /** Negativo = pasado. */
  remainingDays: number | null;
  /** Fracción del intervalo consumida (1 = toca hoy). Sirve para ordenar. */
  progress: number;
  /** Dimensión que manda en la urgencia: la más consumida. */
  trigger: 'km' | 'days' | null;
}

export interface ReminderInput {
  vehicle: Vehicle;
  currentKm: number | null;
  schedules: Schedule[];
  /** Entries del vehículo (se ignoran las borradas). */
  entries: EntryWithItems[];
  today: IsoDate;
}

/** Margen de aviso: 20 % del intervalo, con tope de 1.000 km / 30 días. */
export function soonThresholdKm(intervalKm: number): number {
  return Math.min(intervalKm * 0.2, 1000);
}
export function soonThresholdDays(intervalDays: number): number {
  return Math.min(intervalDays * 0.2, 30);
}

const ITV_SOON_DAYS = 30;

const STATUS_RANK: Record<Urgency, number> = { overdue: 0, soon: 1, ok: 2, unknown: 3 };

/** Última vez que se hizo una tarea: la entry más reciente (fecha, luego km) que la contiene. */
export function findLastDone(entries: EntryWithItems[], taskId: TaskId): LastDone | null {
  let best: EntryWithItems | null = null;
  for (const e of entries) {
    if (e.deleted_at) continue;
    if (!e.items.some((i) => i.task_id === taskId && !i.deleted_at)) continue;
    if (
      !best ||
      e.done_on > best.done_on ||
      (e.done_on === best.done_on && (e.odometer_km ?? -1) > (best.odometer_km ?? -1))
    ) {
      best = e;
    }
  }
  return best ? { date: best.done_on, km: best.odometer_km } : null;
}

function classify(
  remainingKm: number | null,
  remainingDays: number | null,
  soonKm: number | null,
  soonDays: number | null,
): Urgency {
  if ((remainingKm !== null && remainingKm < 0) || (remainingDays !== null && remainingDays < 0)) {
    return 'overdue';
  }
  if (
    (remainingKm !== null && soonKm !== null && remainingKm <= soonKm) ||
    (remainingDays !== null && soonDays !== null && remainingDays <= soonDays)
  ) {
    return 'soon';
  }
  if (remainingKm === null && remainingDays === null) return 'unknown';
  return 'ok';
}

function scheduleReminder(input: ReminderInput, schedule: Schedule): Reminder {
  const { vehicle, currentKm, entries, today } = input;
  const last = findLastDone(entries, schedule.task_id);
  const intervalKm = schedule.interval_km;
  const intervalDays = schedule.interval_days;

  const base: Reminder = {
    vehicleId: vehicle.id,
    taskId: schedule.task_id,
    status: 'unknown',
    last,
    intervalKm,
    intervalDays,
    dueKm: null,
    dueDate: null,
    remainingKm: null,
    remainingDays: null,
    progress: 0,
    trigger: null,
  };
  if (!last) return base;

  const dueKm = intervalKm && last.km !== null ? last.km + intervalKm : null;
  const dueDate = intervalDays ? toIsoDate(addDays(parseISO(last.date), intervalDays)) : null;
  const remainingKm = dueKm !== null && currentKm !== null ? dueKm - currentKm : null;
  const remainingDays =
    dueDate !== null ? differenceInCalendarDays(parseISO(dueDate), parseISO(today)) : null;

  const progressKm =
    remainingKm !== null && intervalKm ? (intervalKm - remainingKm) / intervalKm : null;
  const progressDays =
    remainingDays !== null && intervalDays ? (intervalDays - remainingDays) / intervalDays : null;

  let trigger: Reminder['trigger'] = null;
  if (progressKm !== null && (progressDays === null || progressKm >= progressDays)) trigger = 'km';
  else if (progressDays !== null) trigger = 'days';

  return {
    ...base,
    dueKm,
    dueDate,
    remainingKm,
    remainingDays,
    progress: Math.max(progressKm ?? -Infinity, progressDays ?? -Infinity, 0),
    trigger,
    status: classify(
      remainingKm,
      remainingDays,
      intervalKm ? soonThresholdKm(intervalKm) : null,
      intervalDays ? soonThresholdDays(intervalDays) : null,
    ),
  };
}

function itvReminder(input: ReminderInput): Reminder | null {
  const { vehicle, entries, today } = input;
  const last = findLastDone(entries, 'itv');
  const dueDate = nextItvDate(vehicle.type, vehicle.first_registration, last?.date ?? null);
  if (!dueDate) return null;

  const from = last?.date ?? vehicle.first_registration ?? today;
  const intervalDays = Math.max(differenceInCalendarDays(parseISO(dueDate), parseISO(from)), 1);
  const remainingDays = differenceInCalendarDays(parseISO(dueDate), parseISO(today));
  // Sin ITV registrada y con la primera ya pasada: no sabemos cuándo fue la última,
  // así que no la damos por vencida (en un coche de 2014 eso sería falso casi siempre).
  const status = !last && remainingDays < 0 ? 'unknown' : classify(null, remainingDays, null, ITV_SOON_DAYS);

  return {
    vehicleId: vehicle.id,
    taskId: 'itv',
    status,
    last,
    intervalKm: null,
    intervalDays,
    dueKm: null,
    dueDate,
    remainingKm: null,
    remainingDays,
    progress: Math.max((intervalDays - remainingDays) / intervalDays, 0),
    trigger: 'days',
  };
}

/** Seguro o impuesto: fecha fija anual que avanza con cada renovación registrada. */
function annualDeadlineReminder(input: ReminderInput, taskId: TaskId & ('insurance' | 'road_tax')): Reminder | null {
  const { vehicle, entries, today } = input;
  const renewals = entries
    .filter((e) => !e.deleted_at && e.items.some((i) => i.task_id === taskId && !i.deleted_at))
    .map((e) => e.done_on);
  const dueDate = nextAnnualDue(deadlineAnchor(vehicle, taskId), renewals);
  if (!dueDate) return null;

  const intervalDays = 365;
  const remainingDays = differenceInCalendarDays(parseISO(dueDate), parseISO(today));
  return {
    vehicleId: vehicle.id,
    taskId,
    status: classify(null, remainingDays, null, DEADLINE_SOON_DAYS),
    last: findLastDone(entries, taskId),
    intervalKm: null,
    intervalDays,
    dueKm: null,
    dueDate,
    remainingKm: null,
    remainingDays,
    progress: Math.max((intervalDays - remainingDays) / intervalDays, 0),
    trigger: 'days',
  };
}

export function compareReminders(a: Reminder, b: Reminder): number {
  return STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.progress - a.progress;
}

/** Recordatorios de un vehículo, ordenados de más a menos urgente. */
export function computeReminders(input: ReminderInput): Reminder[] {
  const reminders = input.schedules
    .filter((s) => s.enabled && !s.deleted_at && s.task_id !== 'itv')
    .filter((s) => s.interval_km || s.interval_days)
    .map((s) => scheduleReminder(input, s));

  const itv = itvReminder(input);
  if (itv) reminders.push(itv);
  for (const d of ANNUAL_DEADLINES) {
    const r = annualDeadlineReminder(input, d.taskId as 'insurance' | 'road_tax');
    if (r) reminders.push(r);
  }

  return reminders.sort(compareReminders);
}

export interface VehicleSummary {
  status: Urgency;
  overdue: number;
  soon: number;
  /** Recordatorio más urgente (si lo hay). */
  top: Reminder | null;
}

export function summarize(reminders: Reminder[]): VehicleSummary {
  const sorted = [...reminders].sort(compareReminders);
  const top = sorted[0] ?? null;
  return {
    status: top?.status ?? 'unknown',
    overdue: reminders.filter((r) => r.status === 'overdue').length,
    soon: reminders.filter((r) => r.status === 'soon').length,
    top,
  };
}

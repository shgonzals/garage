import { t } from '@/i18n';
import type { BuiltinTaskId, CustomTask, CustomTaskId, TaskId, VehicleType } from './types';

export interface Interval {
  km: number | null;
  days: number | null;
}

export type TaskCategory = 'motor' | 'transmision' | 'frenos' | 'chasis' | 'electrico' | 'documentacion' | 'otros';

/** Categorías en el orden en que se muestran (plan de mantenimiento, registro rápido). */
export const TASK_CATEGORIES: readonly { id: TaskCategory; label: string }[] = (
  ['motor', 'transmision', 'frenos', 'chasis', 'electrico', 'documentacion', 'otros'] as const
).map((id) => ({
  id,
  get label() {
    return t(`categories.${id}`);
  },
}));

export interface TaskDef {
  id: TaskId;
  label: string;
  emoji: string;
  category: TaskCategory;
  /** Tipos de vehículo en los que tiene sentido (sin indicar: todos). */
  vehicles?: readonly VehicleType[];
  /** Intervalo por defecto por tipo de vehículo. Si falta, no se programa por defecto. */
  defaults: Partial<Record<VehicleType, Interval>>;
  /** Intervalo orientativo al activarla a mano (si no hay `defaults` para ese tipo). */
  suggested?: Partial<Record<VehicleType, Interval>>;
}

/** Los intervalos se guardan en días; en la interfaz se muestran en años. */
export const YEAR = 365;

/** Con cadena: motos, pit bike y kart. */
const CHAIN: readonly VehicleType[] = ['motorcycle', 'moped', 'pitbike', 'kart'];
/** Dos ruedas: horquilla y dirección. */
const TWO_WHEELS: readonly VehicleType[] = ['motorcycle', 'moped', 'pitbike'];
/** Scooters (matriculados como moto o ciclomotor): transmisión por correa y variador. */
const SCOOTERS: readonly VehicleType[] = ['motorcycle', 'moped'];
/** Vehículos de carretera (sin pit bike ni kart de circuito). */
const ROAD: readonly VehicleType[] = ['motorcycle', 'moped', 'car', 'van'];

const TASK_DATA: readonly Omit<TaskDef, 'label'>[] = [
  // ── Motor ──
  {
    id: 'oil',
    emoji: '🛢️',
    category: 'motor',
    defaults: {
      motorcycle: { km: 6000, days: YEAR },
      moped: { km: 3000, days: YEAR },
      car: { km: 15000, days: YEAR },
      van: { km: 15000, days: YEAR },
      pitbike: { km: 10, days: YEAR },
      kart: { km: 10, days: YEAR },
    },
  },
  {
    id: 'air_filter',
    emoji: '🌬️',
    category: 'motor',
    defaults: {
      motorcycle: { km: 12000, days: 2 * YEAR },
      moped: { km: 6000, days: 2 * YEAR },
      car: { km: 30000, days: 2 * YEAR },
      van: { km: 30000, days: 2 * YEAR },
      pitbike: { km: 10, days: null },
      kart: { km: 5, days: null },
    },
  },
  {
    id: 'spark_plugs',
    emoji: '⚡',
    category: 'motor',
    defaults: {
      motorcycle: { km: 12000, days: null },
      moped: { km: 6000, days: null },
      car: { km: 60000, days: null },
      pitbike: { km: 30, days: null },
      kart: { km: 20, days: null },
    },
  },
  {
    id: 'coolant',
    emoji: '❄️',
    category: 'motor',
    defaults: {
      motorcycle: { km: null, days: 2 * YEAR },
      car: { km: null, days: 4 * YEAR },
      van: { km: null, days: 4 * YEAR },
    },
  },
  {
    id: 'valves',
    emoji: '⚙️',
    category: 'motor',
    defaults: { motorcycle: { km: 24000, days: null } },
    suggested: { pitbike: { km: 30, days: null } },
  },
  {
    id: 'timing_belt',
    emoji: '🔗',
    category: 'motor',
    vehicles: ROAD,
    defaults: { car: { km: 120000, days: 10 * YEAR }, van: { km: 120000, days: 10 * YEAR } },
  },
  {
    id: 'fuel_filter',
    emoji: '⛽',
    category: 'motor',
    vehicles: ROAD,
    defaults: {},
    suggested: { motorcycle: { km: 24000, days: null }, car: { km: 60000, days: null }, van: { km: 60000, days: null } },
  },
  {
    id: 'throttle_sync',
    emoji: '🎚️',
    category: 'motor',
    vehicles: ['motorcycle'],
    defaults: {},
    suggested: { motorcycle: { km: 12000, days: null } },
  },
  // ── Transmisión ──
  {
    id: 'chain_lube',
    emoji: '⛓️',
    category: 'transmision',
    vehicles: CHAIN,
    defaults: {
      motorcycle: { km: 500, days: null },
      moped: { km: 500, days: null },
      pitbike: { km: 3, days: null },
      kart: { km: 2, days: null },
    },
  },
  {
    id: 'chain_tension',
    emoji: '🔧',
    category: 'transmision',
    vehicles: CHAIN,
    defaults: {
      motorcycle: { km: 1000, days: null },
      moped: { km: 1000, days: null },
      pitbike: { km: 5, days: null },
      kart: { km: 3, days: null },
    },
  },
  {
    id: 'chain_kit',
    emoji: '🛠️',
    category: 'transmision',
    vehicles: CHAIN,
    defaults: {},
    suggested: {
      motorcycle: { km: 20000, days: null },
      moped: { km: 15000, days: null },
      pitbike: { km: 40, days: null },
      kart: { km: 30, days: null },
    },
  },
  {
    id: 'clutch_fluid',
    emoji: '💧',
    category: 'transmision',
    vehicles: ['motorcycle', 'pitbike'],
    defaults: {},
    suggested: { motorcycle: { km: null, days: 2 * YEAR }, pitbike: { km: null, days: YEAR } },
  },
  {
    id: 'drive_belt',
    emoji: '➰',
    category: 'transmision',
    vehicles: SCOOTERS,
    defaults: {},
    suggested: { motorcycle: { km: 20000, days: null }, moped: { km: 10000, days: null } },
  },
  {
    id: 'variator_rollers',
    emoji: '🔘',
    category: 'transmision',
    vehicles: SCOOTERS,
    defaults: {},
    suggested: { motorcycle: { km: 20000, days: null }, moped: { km: 10000, days: null } },
  },
  {
    id: 'gear_oil',
    emoji: '🫙',
    category: 'transmision',
    defaults: {},
    suggested: {
      motorcycle: { km: 10000, days: 2 * YEAR },
      moped: { km: 5000, days: YEAR },
      car: { km: 60000, days: null },
      van: { km: 60000, days: null },
      pitbike: { km: 20, days: null },
      kart: { km: 20, days: null },
    },
  },
  // ── Frenos ──
  {
    id: 'brake_fluid',
    emoji: '🩸',
    category: 'frenos',
    defaults: {
      motorcycle: { km: null, days: 2 * YEAR },
      moped: { km: null, days: 2 * YEAR },
      car: { km: null, days: 2 * YEAR },
      van: { km: null, days: 2 * YEAR },
      pitbike: { km: null, days: YEAR },
      kart: { km: null, days: YEAR },
    },
  },
  { id: 'brake_pads', emoji: '🛑', category: 'frenos', defaults: {} },
  { id: 'brake_discs', emoji: '💿', category: 'frenos', defaults: {} },
  // ── Ruedas y chasis ──
  { id: 'tires', emoji: '🛞', category: 'chasis', defaults: {} },
  {
    id: 'fork_oil',
    emoji: '🧪',
    category: 'chasis',
    vehicles: TWO_WHEELS,
    defaults: {},
    suggested: {
      motorcycle: { km: 20000, days: 2 * YEAR },
      moped: { km: 15000, days: 2 * YEAR },
      pitbike: { km: 30, days: YEAR },
    },
  },
  {
    id: 'steering_bearings',
    emoji: '🧭',
    category: 'chasis',
    vehicles: TWO_WHEELS,
    defaults: {},
    suggested: { motorcycle: { km: 30000, days: null }, moped: { km: 20000, days: null } },
  },
  // ── Eléctrico ──
  { id: 'battery', emoji: '🔋', category: 'electrico', defaults: {} },
  // ── Documentación ──
  // La ITV no usa schedule: su próxima fecha la calcula domain/itv.ts.
  { id: 'itv', emoji: '📋', category: 'documentacion', vehicles: ROAD, defaults: {} },
  // Vencimientos anuales: su fecha la calcula domain/deadlines.ts; se renuevan registrándolos.
  { id: 'insurance', emoji: '🛡️', category: 'documentacion', vehicles: ROAD, defaults: {} },
  {
    id: 'road_tax',
    emoji: '🏛️',
    category: 'documentacion',
    vehicles: ROAD,
    defaults: {},
  },
  // ── Otros ──
  { id: 'other', emoji: '📝', category: 'otros', defaults: {} },
];

/** Catálogo con el nombre de cada tarea en el idioma actual. */
export const TASKS: readonly TaskDef[] = TASK_DATA.map((d) =>
  Object.defineProperty({ ...d }, 'label', {
    get: () => t(`tasks.${d.id as BuiltinTaskId}`),
    enumerable: true,
  }) as TaskDef,
);

/** Tareas que van por fecha propia (no por intervalo): no se configuran en el plan. */
export const DATED_TASKS: readonly TaskId[] = ['itv', 'insurance', 'road_tax'];

/** Tareas del catálogo que tienen sentido para un tipo de vehículo. */
export function tasksForType(type: VehicleType): TaskDef[] {
  return TASKS.filter((t) => !t.vehicles || t.vehicles.includes(type));
}

/** Intervalo con el que se rellena una tarea al activarla en el plan. */
export function suggestedInterval(task: TaskDef, type: VehicleType): Interval | null {
  return task.defaults[type] ?? task.suggested?.[type] ?? null;
}

const BY_ID = new Map<string, TaskDef>(TASKS.map((t) => [t.id, t]));

/** Iconos para elegir al crear una tarea personalizada. */
export const CUSTOM_TASK_EMOJIS = ['🔧', '🔩', '🪛', '🧽', '💡', '🧴', '🧯', '🪫'] as const;

const CUSTOM_ID = /^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Tareas personalizadas conocidas, para que `getTask` las resuelva igual que las del catálogo.
 * Incluye las borradas: el historial sigue mostrando su nombre. Lo rellena el store al recargar.
 */
const customById = new Map<string, TaskDef>();

export function registerCustomTasks(tasks: readonly CustomTask[]) {
  customById.clear();
  for (const t of tasks) customById.set(t.id, { id: t.id, label: t.label, emoji: t.emoji, category: 'otros', defaults: {} });
}

export function isCustomTaskId(value: string): value is CustomTaskId {
  return CUSTOM_ID.test(value);
}

export function getTask(id: TaskId): TaskDef {
  const task = BY_ID.get(id) ?? customById.get(id);
  if (task) return task;
  // Tarea personalizada aún no cargada (o de una copia a medio importar): no romper la pantalla.
  if (isCustomTaskId(id)) return { id, label: t('tasks.custom'), emoji: '🔧', category: 'otros', defaults: {} };
  throw new Error(`Tarea desconocida: ${id}`);
}

export function isBuiltinTaskId(value: string): value is BuiltinTaskId {
  return BY_ID.has(value);
}

export function isTaskId(value: string): value is TaskId {
  return isBuiltinTaskId(value) || isCustomTaskId(value);
}

/** Tareas que se programan automáticamente al dar de alta un vehículo de este tipo. */
export function defaultSchedulesFor(type: VehicleType): { taskId: TaskId; interval: Interval }[] {
  return TASKS.flatMap((t) => {
    const interval = t.defaults[type];
    return interval ? [{ taskId: t.id, interval }] : [];
  });
}

export const VEHICLE_TYPES: readonly { id: VehicleType; label: string; emoji: string }[] = (
  [
    ['motorcycle', '🏍️'],
    ['moped', '🛵'],
    ['car', '🚗'],
    ['van', '🚐'],
    ['pitbike', '🏁'],
    ['kart', '🏎️'],
  ] as const
).map(([id, emoji]) => ({
  id,
  emoji,
  get label() {
    return t(`vehicleTypes.${id}`);
  },
}));

/** Circula por vía pública: tiene matrícula, ITV, seguro e impuesto. */
export function isRoadVehicle(type: VehicleType): boolean {
  return ROAD.includes(type);
}

export function vehicleTypeLabel(type: VehicleType): string {
  return VEHICLE_TYPES.find((v) => v.id === type)?.label ?? type;
}

export function vehicleTypeEmoji(type: VehicleType): string {
  return VEHICLE_TYPES.find((v) => v.id === type)?.emoji ?? '🚗';
}

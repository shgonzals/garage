import type { BuiltinTaskId, CustomTask, CustomTaskId, TaskId, VehicleType } from './types';

export interface Interval {
  km: number | null;
  days: number | null;
}

export interface TaskDef {
  id: TaskId;
  label: string;
  emoji: string;
  /** Intervalo por defecto por tipo de vehículo. Si falta, no se programa por defecto. */
  defaults: Partial<Record<VehicleType, Interval>>;
}

/** Los intervalos se guardan en días; en la interfaz se muestran en años. */
export const YEAR = 365;

export const TASKS: readonly TaskDef[] = [
  {
    id: 'oil',
    label: 'Aceite y filtro',
    emoji: '🛢️',
    defaults: {
      motorcycle: { km: 6000, days: YEAR },
      moped: { km: 3000, days: YEAR },
      car: { km: 15000, days: YEAR },
      van: { km: 15000, days: YEAR },
    },
  },
  {
    id: 'chain_lube',
    label: 'Engrase de cadena',
    emoji: '⛓️',
    defaults: { motorcycle: { km: 500, days: null }, moped: { km: 500, days: null } },
  },
  {
    id: 'chain_tension',
    label: 'Tensión de cadena',
    emoji: '🔧',
    defaults: { motorcycle: { km: 1000, days: null }, moped: { km: 1000, days: null } },
  },
  {
    id: 'brake_fluid',
    label: 'Líquido de frenos',
    emoji: '🩸',
    defaults: {
      motorcycle: { km: null, days: 2 * YEAR },
      moped: { km: null, days: 2 * YEAR },
      car: { km: null, days: 2 * YEAR },
      van: { km: null, days: 2 * YEAR },
    },
  },
  {
    id: 'coolant',
    label: 'Refrigerante',
    emoji: '❄️',
    defaults: {
      motorcycle: { km: null, days: 2 * YEAR },
      car: { km: null, days: 4 * YEAR },
      van: { km: null, days: 4 * YEAR },
    },
  },
  {
    id: 'air_filter',
    label: 'Filtro de aire',
    emoji: '🌬️',
    defaults: {
      motorcycle: { km: 12000, days: 2 * YEAR },
      moped: { km: 6000, days: 2 * YEAR },
      car: { km: 30000, days: 2 * YEAR },
      van: { km: 30000, days: 2 * YEAR },
    },
  },
  {
    id: 'spark_plugs',
    label: 'Bujías',
    emoji: '⚡',
    defaults: {
      motorcycle: { km: 12000, days: null },
      moped: { km: 6000, days: null },
      car: { km: 60000, days: null },
    },
  },
  {
    id: 'valves',
    label: 'Reglaje de válvulas',
    emoji: '⚙️',
    defaults: { motorcycle: { km: 24000, days: null } },
  },
  {
    id: 'timing_belt',
    label: 'Correa de distribución',
    emoji: '🔗',
    defaults: { car: { km: 120000, days: 10 * YEAR }, van: { km: 120000, days: 10 * YEAR } },
  },
  { id: 'brake_pads', label: 'Pastillas de freno', emoji: '🛑', defaults: {} },
  { id: 'tires', label: 'Neumáticos', emoji: '🛞', defaults: {} },
  { id: 'battery', label: 'Batería', emoji: '🔋', defaults: {} },
  // La ITV no usa schedule: su próxima fecha la calcula domain/itv.ts.
  { id: 'itv', label: 'ITV', emoji: '📋', defaults: {} },
  // Vencimientos anuales: su fecha la calcula domain/deadlines.ts; se renuevan registrándolos.
  { id: 'insurance', label: 'Seguro', emoji: '🛡️', defaults: {} },
  { id: 'road_tax', label: 'Impuesto de circulación', emoji: '🏛️', defaults: {} },
  { id: 'other', label: 'Otro', emoji: '📝', defaults: {} },
];

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
  for (const t of tasks) customById.set(t.id, { id: t.id, label: t.label, emoji: t.emoji, defaults: {} });
}

export function isCustomTaskId(value: string): value is CustomTaskId {
  return CUSTOM_ID.test(value);
}

export function getTask(id: TaskId): TaskDef {
  const task = BY_ID.get(id) ?? customById.get(id);
  if (task) return task;
  // Tarea personalizada aún no cargada (o de una copia a medio importar): no romper la pantalla.
  if (isCustomTaskId(id)) return { id, label: 'Tarea personalizada', emoji: '🔧', defaults: {} };
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

export const VEHICLE_TYPES: readonly { id: VehicleType; label: string; emoji: string }[] = [
  { id: 'motorcycle', label: 'Moto / Quad', emoji: '🏍️' },
  { id: 'moped', label: 'Ciclomotor', emoji: '🛵' },
  { id: 'car', label: 'Turismo', emoji: '🚗' },
  { id: 'van', label: 'Furgoneta (N1)', emoji: '🚐' },
];

export function vehicleTypeLabel(type: VehicleType): string {
  return VEHICLE_TYPES.find((v) => v.id === type)?.label ?? type;
}

export function vehicleTypeEmoji(type: VehicleType): string {
  return VEHICLE_TYPES.find((v) => v.id === type)?.emoji ?? '🚗';
}

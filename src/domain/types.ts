/** Fecha de calendario en formato ISO `YYYY-MM-DD`. */
export type IsoDate = string;
/** Instante en formato ISO 8601 completo (UTC). */
export type IsoDateTime = string;

export type VehicleType = 'motorcycle' | 'moped' | 'car' | 'van';

export type TaskId =
  | 'oil'
  | 'chain_lube'
  | 'chain_tension'
  | 'brake_fluid'
  | 'coolant'
  | 'air_filter'
  | 'spark_plugs'
  | 'valves'
  | 'timing_belt'
  | 'brake_pads'
  | 'tires'
  | 'battery'
  | 'itv'
  | 'other';

/** Columnas comunes a todas las tablas sincronizables (ADR: UUID v7 + borrado lógico). */
export interface Row {
  id: string;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  deleted_at: IsoDateTime | null;
}

export interface Vehicle extends Row {
  name: string;
  type: VehicleType;
  make: string | null;
  model: string | null;
  plate: string | null;
  /** Fecha de primera matriculación: base del cálculo de la ITV. */
  first_registration: IsoDate | null;
  /** Foto de perfil como data URL JPEG cuadrada y reducida (ver `lib/image.ts`). */
  photo: string | null;
}

export interface OdometerReading extends Row {
  vehicle_id: string;
  km: number;
  read_on: IsoDate;
  source: 'manual' | 'entry';
}

export interface Entry extends Row {
  vehicle_id: string;
  done_on: IsoDate;
  odometer_km: number | null;
  /** ADR: dinero en céntimos (entero) con moneda explícita. */
  cost_cents: number | null;
  currency: string;
  notes: string | null;
}

export interface EntryItem extends Row {
  entry_id: string;
  task_id: TaskId;
  notes: string | null;
}

export interface Schedule {
  vehicle_id: string;
  task_id: TaskId;
  interval_km: number | null;
  interval_days: number | null;
  enabled: boolean;
  updated_at: IsoDateTime;
  deleted_at: IsoDateTime | null;
}

/** Entry con sus tareas ya resueltas, para timeline y motor de recordatorios. */
export interface EntryWithItems extends Entry {
  items: EntryItem[];
}

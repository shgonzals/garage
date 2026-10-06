import { z } from 'zod';
import { TASKS, VEHICLE_TYPES } from './tasks';
import type { TaskId, VehicleType } from './types';

/**
 * Copia de seguridad: todas las filas de todas las tablas, borradas incluidas, en JSON.
 *
 * - `format` cambia solo si cambia la forma del archivo; `schema_version` es la migración de la BD
 *   que lo generó. Una copia de una app más nueva (schema mayor) se rechaza.
 * - Los objetos de Zod descartan claves desconocidas: solo entran en la BD columnas conocidas.
 * - Columnas añadidas en migraciones posteriores llevan `.default(null)`, así las copias antiguas siguen valiendo.
 */
export const BACKUP_FORMAT = 1;

const id = z.string().min(1).max(64);
const text = z.string().max(10_000).nullable();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.string().min(10).max(40);
const row = { id, created_at: timestamp, updated_at: timestamp, deleted_at: timestamp.nullable() };
const vehicleTypes = VEHICLE_TYPES.map((v) => v.id) as [VehicleType, ...VehicleType[]];
const taskIds = TASKS.map((t) => t.id) as [TaskId, ...TaskId[]];

const vehicle = z.object({
  ...row,
  name: z.string().min(1).max(200),
  type: z.enum(vehicleTypes),
  make: text,
  model: text,
  plate: text,
  first_registration: isoDate.nullable(),
  photo: z.string().startsWith('data:image/').max(1_000_000).nullable().default(null), // migración 2
});

const entry = z.object({
  ...row,
  vehicle_id: id,
  done_on: isoDate,
  odometer_km: z.number().int().min(0).nullable(),
  cost_cents: z.number().int().min(0).nullable(),
  currency: z.string().length(3),
  notes: text,
});

const odometerReading = z.object({
  ...row,
  vehicle_id: id,
  km: z.number().int().min(0),
  read_on: isoDate,
  source: z.enum(['manual', 'entry']),
  entry_id: id.nullable().default(null), // migración 3
});

const entryItem = z.object({
  ...row,
  entry_id: id,
  task_id: z.enum(taskIds),
  notes: text,
});

const schedule = z.object({
  vehicle_id: id,
  task_id: z.enum(taskIds),
  interval_km: z.number().int().positive().nullable(),
  interval_days: z.number().int().positive().nullable(),
  enabled: z.union([z.literal(0), z.literal(1)]),
  updated_at: timestamp,
  deleted_at: timestamp.nullable(),
});

const document = z.object({
  ...row,
  vehicle_id: id,
  entry_id: id.nullable(),
  kind: z.string().min(1).max(40),
  title: text,
  uri: z.string().min(1).max(2_000_000),
  mime_type: text,
  expires_on: isoDate.nullable(),
});

/** Tablas en orden de importación (las claves foráneas están activas). */
export const BACKUP_TABLES = {
  vehicles: { schema: vehicle, key: ['id'] },
  entries: { schema: entry, key: ['id'] },
  odometer_readings: { schema: odometerReading, key: ['id'] },
  entry_items: { schema: entryItem, key: ['id'] },
  schedules: { schema: schedule, key: ['vehicle_id', 'task_id'] },
  documents: { schema: document, key: ['id'] },
} as const;

export type BackupTable = keyof typeof BACKUP_TABLES;

export const backupSchema = z.object({
  app: z.literal('garage'),
  format: z.literal(BACKUP_FORMAT),
  schema_version: z.number().int().min(1),
  exported_at: z.string(),
  data: z.object({
    vehicles: z.array(vehicle),
    entries: z.array(entry),
    odometer_readings: z.array(odometerReading),
    entry_items: z.array(entryItem),
    schedules: z.array(schedule),
    documents: z.array(document).default([]),
  }),
});
export type Backup = z.output<typeof backupSchema>;

/** Columnas de cada tabla, sacadas del esquema: lo único que se escribe al importar. */
export function backupColumns(table: BackupTable): string[] {
  return Object.keys(BACKUP_TABLES[table].schema.shape);
}

export type BackupParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

/** Valida el texto de un archivo de copia. Los errores van en lenguaje de usuario. */
export function parseBackup(json: string, currentSchema: number): BackupParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'El archivo no es una copia de Garage (no es JSON válido).' };
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== 'garage') {
    return { ok: false, error: 'El archivo no es una copia de Garage.' };
  }
  const version = (raw as { schema_version?: unknown }).schema_version;
  if (typeof version === 'number' && version > currentSchema) {
    return { ok: false, error: 'La copia es de una versión más nueva de la app. Actualiza Garage e inténtalo de nuevo.' };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `La copia está dañada (${issue?.path.join('.') ?? 'formato'}).` };
  }
  return { ok: true, backup: parsed.data };
}

/** `garage-copia-2026-10-06.json` */
export function backupFileName(today: string): string {
  return `garage-copia-${today}.json`;
}

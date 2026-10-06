import { z } from 'zod';
import { isTaskId, VEHICLE_TYPES } from './tasks';
import type { TaskId, VehicleType } from './types';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha no válida');

const optionalText = z
  .string()
  .trim()
  .transform((s) => (s === '' ? null : s))
  .nullable();

const km = z.number({ error: 'Introduce los km' }).int('Sin decimales').min(0, 'No puede ser negativo').max(5_000_000);

const vehicleTypes = VEHICLE_TYPES.map((v) => v.id) as [VehicleType, ...VehicleType[]];
/** Tarea del catálogo o personalizada (`custom:<uuid>`). */
export const taskIdSchema = z.custom<TaskId>((v) => typeof v === 'string' && isTaskId(v), 'Tarea no válida');

export const vehicleInputSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre').max(60),
  type: z.enum(vehicleTypes),
  make: optionalText,
  model: optionalText,
  plate: optionalText.transform((s) => s?.toUpperCase().replace(/\s+/g, '') ?? null),
  first_registration: isoDate.nullable(),
  /** Data URL ya reducida en el cliente; el tope evita meter una foto original en la BD por error. */
  photo: z
    .string()
    .startsWith('data:image/', 'Imagen no válida')
    .max(1_000_000, 'La foto es demasiado grande')
    .nullable()
    .default(null),
  /** Solo en el alta: lectura inicial del odómetro. */
  initial_km: km.nullable(),
});
export type VehicleInput = z.input<typeof vehicleInputSchema>;
export type VehicleData = z.output<typeof vehicleInputSchema>;

export const quickLogSchema = z.object({
  vehicle_id: z.string().min(1, 'Elige un vehículo'),
  done_on: isoDate,
  odometer_km: km.nullable(),
  task_ids: z.array(taskIdSchema).min(1, 'Marca al menos una tarea'),
  /** Importe en euros tal y como lo escribe el usuario; se guarda en céntimos. */
  cost: z.number().min(0).max(1_000_000).nullable(),
  notes: optionalText,
});
export type QuickLogInput = z.input<typeof quickLogSchema>;
export type QuickLogData = z.output<typeof quickLogSchema>;

export const scheduleInputSchema = z.object({
  interval_km: z.number().int().positive().nullable(),
  interval_days: z.number().int().positive().nullable(),
  enabled: z.boolean(),
});
export type ScheduleInput = z.output<typeof scheduleInputSchema>;

/** Alta de una tarea personalizada con su intervalo (al menos km o días). */
export const customTaskInputSchema = z
  .object({
    label: z.string().trim().min(1, 'Ponle un nombre').max(40, 'Máximo 40 caracteres'),
    emoji: z.string().min(1).max(8),
    interval_km: z.number().int().positive().nullable(),
    interval_days: z.number().int().positive().nullable(),
  })
  .refine((v) => v.interval_km !== null || v.interval_days !== null, {
    message: 'Indica km, años o ambos',
    path: ['interval'],
  });
export type CustomTaskInput = z.output<typeof customTaskInputSchema>;

/** Euros (posible float del input) → céntimos enteros. */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

/** Primer mensaje de error por campo, para pintar bajo cada input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    out[key] ??= issue.message;
  }
  return out;
}

import { z } from 'zod';
import type { IsoDate, Row } from './types';

/**
 * Repostajes y consumo.
 *
 * Los litros se guardan en centilitros enteros (como el dinero en céntimos): sin errores de coma
 * flotante. El consumo se calcula "de lleno a lleno": entre dos repostajes con el depósito lleno,
 * lo gastado es todo lo repostado después del primero (parciales incluidos) y la distancia, la
 * diferencia de odómetro. Con repostajes parciales sueltos no se puede saber lo gastado de verdad.
 */
export interface FuelLog extends Row {
  vehicle_id: string;
  filled_on: IsoDate;
  /** En la unidad del vehículo (km u horas). Necesario para el consumo. */
  odometer_km: number | null;
  /** Centilitros: 32,5 L → 3250. */
  centiliters: number;
  cost_cents: number | null;
  currency: string;
  /** 1 si se llenó el depósito (permite calcular el consumo). */
  full_tank: number;
  notes: string | null;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida');

export const fuelInputSchema = z.object({
  vehicle_id: z.string().min(1, 'Elige un vehículo'),
  filled_on: isoDate,
  odometer_km: z.number().int('Sin decimales').min(0).max(5_000_000).nullable(),
  /** Litros tal y como los escribe el usuario. */
  liters: z.number({ error: 'Indica los litros' }).positive('Indica los litros').max(1000),
  /** Importe total en euros (opcional). */
  cost: z.number().min(0).max(100_000).nullable(),
  full_tank: z.boolean(),
  notes: z
    .string()
    .trim()
    .transform((s) => (s === '' ? null : s))
    .nullable(),
});
export type FuelInput = z.input<typeof fuelInputSchema>;
export type FuelData = z.output<typeof fuelInputSchema>;

export function litersToCentiliters(liters: number): number {
  return Math.round(liters * 100);
}

export interface FuelEconomyStretch {
  from: IsoDate;
  to: IsoDate;
  distance: number;
  centiliters: number;
  /** Litros cada 100 km (o litros por hora en vehículos medidos en horas). */
  consumption: number;
}

/**
 * Tramos de consumo "de lleno a lleno". Un tramo empieza en un repostaje lleno con odómetro y
 * termina en el siguiente lleno con odómetro; suma los litros de todo lo repostado tras el primero.
 */
export function fuelEconomy(logs: readonly FuelLog[], per: 100 | 1 = 100): FuelEconomyStretch[] {
  const sorted = logs
    .filter((l) => !l.deleted_at)
    .sort((a, b) => a.filled_on.localeCompare(b.filled_on) || (a.odometer_km ?? 0) - (b.odometer_km ?? 0));
  const stretches: FuelEconomyStretch[] = [];
  let start: FuelLog | null = null;
  let liters = 0;
  for (const log of sorted) {
    if (start) liters += log.centiliters;
    if (log.full_tank && log.odometer_km !== null) {
      if (start && start.odometer_km !== null && log.odometer_km > start.odometer_km) {
        const distance = log.odometer_km - start.odometer_km;
        stretches.push({
          from: start.filled_on,
          to: log.filled_on,
          distance,
          centiliters: liters,
          consumption: (liters / 100 / distance) * per,
        });
      }
      start = log;
      liters = 0;
    }
  }
  return stretches;
}

/** Consumo medio ponderado por distancia de todos los tramos (`null` si no hay ninguno). */
export function averageConsumption(stretches: readonly FuelEconomyStretch[], per: 100 | 1 = 100): number | null {
  const distance = stretches.reduce((s, x) => s + x.distance, 0);
  const cl = stretches.reduce((s, x) => s + x.centiliters, 0);
  return distance > 0 ? (cl / 100 / distance) * per : null;
}

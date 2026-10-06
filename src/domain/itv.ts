import { addMonths, addYears, differenceInMonths, parseISO } from 'date-fns';
import { toIsoDate } from './dates';
import type { IsoDate, VehicleType } from './types';

/**
 * Intervalos de ITV en España según tipo de vehículo:
 *
 * | Tipo        | Exento      | Después                                     |
 * |-------------|-------------|---------------------------------------------|
 * | Turismo     | < 4 años    | Bienal (4-10) → Anual (> 10)                |
 * | Moto/Quad   | < 4 años    | Bienal siempre                              |
 * | Ciclomotor  | < 3 años    | Bienal siempre                              |
 * | Furgoneta   | < 2 años    | Bienal (2-6) → Anual (6-10) → Semestral (>10) |
 *
 * Pit bike y kart no circulan por vía pública: no pasan ITV.
 */
const EXEMPT_YEARS: Partial<Record<VehicleType, number>> = {
  car: 4,
  motorcycle: 4,
  moped: 3,
  van: 2,
};

export function hasItv(type: VehicleType): boolean {
  return EXEMPT_YEARS[type] !== undefined;
}

/** Meses hasta la siguiente ITV según la antigüedad (años) del vehículo en la última. */
export function itvIntervalMonths(type: VehicleType, ageYears: number): number {
  switch (type) {
    case 'car':
      return ageYears < 10 ? 24 : 12;
    case 'motorcycle':
    case 'moped':
      return 24;
    case 'van':
      if (ageYears < 6) return 24;
      if (ageYears < 10) return 12;
      return 6;
    default:
      return 24;
  }
}

/**
 * Próxima fecha de ITV.
 *
 * - Sin ITV registrada: primera matriculación + años de exención.
 * - Con ITV registrada: última ITV + intervalo según antigüedad en ese momento.
 *   La antigüedad se redondea al año más cercano porque la inspección se suele
 *   pasar unas semanas antes del aniversario.
 *
 * Devuelve `null` si no hay datos suficientes.
 */
export function nextItvDate(
  type: VehicleType,
  firstRegistration: IsoDate | null,
  lastItv: IsoDate | null,
): IsoDate | null {
  const exempt = EXEMPT_YEARS[type];
  if (exempt === undefined) return null;
  if (!lastItv) {
    if (!firstRegistration) return null;
    return toIsoDate(addYears(parseISO(firstRegistration), exempt));
  }
  const last = parseISO(lastItv);
  const ageYears = firstRegistration
    ? Math.round(differenceInMonths(last, parseISO(firstRegistration)) / 12)
    : exempt;
  return toIsoDate(addMonths(last, itvIntervalMonths(type, ageYears)));
}

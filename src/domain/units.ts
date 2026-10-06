import { t } from '@/i18n';
import type { VehicleType } from './types';

/**
 * Unidad de uso de un vehículo: km en los de carretera, horas de motor en pit bike y kart
 * (su mantenimiento se mide así: "aceite cada 10 h").
 *
 * Se guarda en los mismos campos que los km (odómetro, intervalos, aplazamientos): solo cambia
 * cómo se lee y se escribe en pantalla. Las horas son enteras.
 */
export type UsageUnit = 'km' | 'h';

export interface UnitInfo {
  /** Sufijo tras una cifra: "23.050 km", "45 h". */
  short: UsageUnit;
  /** En frase: "los km", "las horas". */
  noun: string;
  /** Título del historial de lecturas. */
  title: string;
  /** Etiqueta del valor actual. */
  current: string;
  /** Escalones de "posponer" por uso. */
  snoozeSteps: readonly [number, number];
  /** Más que esto al día es un error al teclear (ver domain/odometer.ts). */
  maxPerDay: number;
}

export const UNITS: Record<UsageUnit, UnitInfo> = {
  km: {
    short: 'km',
    get noun() {
      return t('units.km.noun');
    },
    get title() {
      return t('units.km.title');
    },
    get current() {
      return t('units.km.current');
    },
    snoozeSteps: [500, 1000],
    maxPerDay: 1500,
  },
  h: {
    short: 'h',
    get noun() {
      return t('units.h.noun');
    },
    get title() {
      return t('units.h.title');
    },
    get current() {
      return t('units.h.current');
    },
    snoozeSteps: [5, 10],
    maxPerDay: 24,
  },
};

export function usageUnit(type: VehicleType): UsageUnit {
  return type === 'kart' || type === 'pitbike' ? 'h' : 'km';
}

export function unitInfo(type: VehicleType): UnitInfo {
  return UNITS[usageUnit(type)];
}

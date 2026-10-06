import { averageConsumption, fuelEconomy, type FuelLog } from './fuel';
import type { Entry, OdometerReading } from './types';

/*
 * Estadísticas de gasto por año. Todo en céntimos; los repostajes y los partes de trabajo se
 * cuentan aparte para poder separarlos en el gráfico.
 */

export interface MonthSpend {
  /** 0 = enero. */
  month: number;
  maintenance: number;
  fuel: number;
}

const inYear = (date: string, year: number) => date.startsWith(`${year}-`);
const monthOf = (date: string) => Number(date.slice(5, 7)) - 1;

/** Gasto de cada mes del año (siempre 12 meses, aunque estén a cero). */
export function monthlySpending(
  entries: readonly Pick<Entry, 'done_on' | 'cost_cents'>[],
  fuelLogs: readonly Pick<FuelLog, 'filled_on' | 'cost_cents'>[],
  year: number,
): MonthSpend[] {
  const months = Array.from({ length: 12 }, (_, month) => ({ month, maintenance: 0, fuel: 0 }));
  for (const e of entries) {
    if (e.cost_cents !== null && inYear(e.done_on, year)) months[monthOf(e.done_on)]!.maintenance += e.cost_cents;
  }
  for (const f of fuelLogs) {
    if (f.cost_cents !== null && inYear(f.filled_on, year)) months[monthOf(f.filled_on)]!.fuel += f.cost_cents;
  }
  return months;
}

/**
 * Km (u horas) recorridos en el año: de la última lectura anterior al 1 de enero (o la primera del
 * año si no la hay) a la última del año. `null` si no hay dos lecturas con las que medirlo.
 */
export function distanceInYear(readings: readonly Pick<OdometerReading, 'read_on' | 'km'>[], year: number): number | null {
  const start = `${year}-01-01`;
  const before = readings.filter((r) => r.read_on < start);
  const during = readings.filter((r) => inYear(r.read_on, year));
  if (during.length === 0) return null;
  const end = Math.max(...during.map((r) => r.km));
  const base = before.length > 0 ? Math.max(...before.map((r) => r.km)) : Math.min(...during.map((r) => r.km));
  return end > base ? end - base : null;
}

export interface YearStats {
  maintenance: number;
  fuel: number;
  total: number;
  /** Litros repostados en el año, en centilitros. */
  fuelCentiliters: number;
  distance: number | null;
  /** Céntimos por km (u hora) recorrido; `null` sin distancia. */
  costPerUnit: number | null;
  /** L/100 km (o L/h) de los tramos lleno a lleno que acaban en el año. */
  consumption: number | null;
}

/** Resumen del año de un vehículo. `per` = 100 para km, 1 para horas. */
export function vehicleYearStats(
  entries: readonly Entry[],
  fuelLogs: readonly FuelLog[],
  readings: readonly OdometerReading[],
  year: number,
  per: 100 | 1 = 100,
): YearStats {
  const months = monthlySpending(entries, fuelLogs, year);
  const maintenance = months.reduce((s, m) => s + m.maintenance, 0);
  const fuel = months.reduce((s, m) => s + m.fuel, 0);
  const total = maintenance + fuel;
  const distance = distanceInYear(readings, year);
  const stretches = fuelEconomy([...fuelLogs], per).filter((s) => inYear(s.to, year));
  return {
    maintenance,
    fuel,
    total,
    fuelCentiliters: fuelLogs.filter((f) => inYear(f.filled_on, year)).reduce((s, f) => s + f.centiliters, 0),
    distance,
    costPerUnit: distance ? total / distance : null,
    consumption: averageConsumption(stretches, per),
  };
}

/** Años con algún gasto apuntado, más el actual; del más reciente al más antiguo. */
export function yearsWithData(
  entries: readonly Pick<Entry, 'done_on'>[],
  fuelLogs: readonly Pick<FuelLog, 'filled_on'>[],
  currentYear: number,
): number[] {
  const years = new Set([currentYear]);
  for (const e of entries) years.add(Number(e.done_on.slice(0, 4)));
  for (const f of fuelLogs) years.add(Number(f.filled_on.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

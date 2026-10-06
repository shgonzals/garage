import { describe, expect, it } from 'vitest';
import type { FuelLog } from '@/domain/fuel';
import { distanceInYear, monthlySpending, vehicleYearStats, yearsWithData } from '@/domain/stats';
import type { Entry, OdometerReading } from '@/domain/types';

const row = { created_at: '', updated_at: '', deleted_at: null };
const entry = (done_on: string, cost: number | null): Entry => ({
  ...row, id: done_on, vehicle_id: 'v1', done_on, odometer_km: null, cost_cents: cost, currency: 'EUR', notes: null,
});
const fuel = (filled_on: string, km: number, cl: number, cost: number | null): FuelLog => ({
  ...row, id: filled_on, vehicle_id: 'v1', filled_on, odometer_km: km, centiliters: cl, cost_cents: cost,
  currency: 'EUR', full_tank: 1, notes: null,
});
const reading = (read_on: string, km: number): OdometerReading => ({
  ...row, id: read_on, vehicle_id: 'v1', read_on, km, source: 'manual', entry_id: null,
});

describe('estadísticas de gasto', () => {
  it('reparte el gasto por meses y separa mantenimiento de combustible', () => {
    const months = monthlySpending(
      [entry('2026-03-14', 12050), entry('2026-03-20', 1000), entry('2025-03-01', 999), entry('2026-05-01', null)],
      [fuel('2026-03-02', 0, 1000, 2000), fuel('2026-12-31', 0, 1000, 1500)],
      2026,
    );
    expect(months).toHaveLength(12);
    expect(months[2]).toEqual({ month: 2, maintenance: 13050, fuel: 2000 });
    expect(months[11]!.fuel).toBe(1500);
    expect(months[4]).toEqual({ month: 4, maintenance: 0, fuel: 0 });
  });

  it('km del año: desde la última lectura anterior, o la primera del año', () => {
    expect(distanceInYear([reading('2025-12-10', 10000), reading('2026-02-01', 10400), reading('2026-09-01', 12000)], 2026)).toBe(2000);
    expect(distanceInYear([reading('2026-02-01', 10400), reading('2026-09-01', 12000)], 2026)).toBe(1600);
    expect(distanceInYear([reading('2026-02-01', 10400)], 2026)).toBeNull();
    expect(distanceInYear([reading('2025-02-01', 10400)], 2026)).toBeNull();
  });

  it('resumen del año: coste por km y consumo de lleno a lleno', () => {
    const s = vehicleYearStats(
      [entry('2026-06-01', 10000)],
      [fuel('2026-01-05', 10000, 4000, 6000), fuel('2026-02-05', 10500, 3000, 4500)],
      [reading('2025-12-01', 10000), reading('2026-06-01', 12000)],
      2026,
    );
    expect(s).toMatchObject({ maintenance: 10000, fuel: 10500, total: 20500, fuelCentiliters: 7000, distance: 2000 });
    expect(s.costPerUnit).toBeCloseTo(10.25); // céntimos por km
    expect(s.consumption).toBeCloseTo(6); // 30 L / 500 km
  });

  it('años con datos: siempre incluye el actual', () => {
    expect(yearsWithData([entry('2024-01-01', 1)], [fuel('2025-06-01', 0, 1, 1)], 2026)).toEqual([2026, 2025, 2024]);
    expect(yearsWithData([], [], 2026)).toEqual([2026]);
  });
});

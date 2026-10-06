import { describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate } from '@/db/migrations';
import { GarageRepository } from '@/db/repository';
import { parseBackup } from '@/domain/backup';
import { averageConsumption, fuelEconomy, fuelInputSchema, type FuelLog } from '@/domain/fuel';
import { vehicleInputSchema } from '@/domain/schemas';
import { openMemoryDatabase } from './helpers/sqljs';

let n = 0;
const log = (filled_on: string, odometer_km: number | null, liters: number, full = true): FuelLog => ({
  id: `f${++n}`,
  vehicle_id: 'v1',
  filled_on,
  odometer_km,
  centiliters: Math.round(liters * 100),
  cost_cents: null,
  currency: 'EUR',
  full_tank: full ? 1 : 0,
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
});

describe('consumo de lleno a lleno', () => {
  it('entre dos llenos: litros del segundo / km recorridos', () => {
    const [s] = fuelEconomy([log('2026-01-01', 10000, 40), log('2026-01-10', 10500, 30)]);
    expect(s).toMatchObject({ distance: 500, centiliters: 3000 });
    expect(s!.consumption).toBeCloseTo(6); // 30 L / 500 km → 6 L/100 km
  });

  it('los repostajes parciales intermedios suman al tramo', () => {
    const stretches = fuelEconomy([
      log('2026-01-01', 10000, 40),
      log('2026-01-05', 10200, 10, false),
      log('2026-01-10', 10500, 20),
    ]);
    expect(stretches).toHaveLength(1);
    expect(stretches[0]!.consumption).toBeCloseTo(6); // (10 + 20) / 500
  });

  it('sin dos llenos con odómetro no hay consumo', () => {
    expect(fuelEconomy([log('2026-01-01', 10000, 40)])).toEqual([]);
    expect(fuelEconomy([log('2026-01-01', null, 40), log('2026-01-10', 10500, 30)])).toEqual([]);
    expect(averageConsumption([])).toBeNull();
  });

  it('media ponderada por distancia', () => {
    const stretches = fuelEconomy([
      log('2026-01-01', 10000, 40),
      log('2026-01-10', 10100, 10), // 10 L/100
      log('2026-01-20', 10500, 20), // 5 L/100
    ]);
    expect(averageConsumption(stretches)).toBeCloseTo(6); // 30 L / 500 km
  });

  it('en horas: litros por hora', () => {
    const [s] = fuelEconomy([log('2026-01-01', 40, 5), log('2026-01-08', 44, 6)], 1);
    expect(s!.consumption).toBeCloseTo(1.5); // 6 L / 4 h
  });

  it('validación del formulario', () => {
    const base = { vehicle_id: 'v1', filled_on: '2026-10-06', odometer_km: 23050, cost: 58.4, full_tank: true, notes: '' };
    expect(fuelInputSchema.safeParse({ ...base, liters: 32.5 }).success).toBe(true);
    expect(fuelInputSchema.safeParse({ ...base, liters: 0 }).success).toBe(false);
  });
});

describe('repostajes en la base de datos', () => {
  it('crear, corregir y borrar arrastra su lectura de km; viaja en la copia', async () => {
    const db = await openMemoryDatabase();
    await migrate(db);
    const repo = new GarageRepository(db);
    const v = await repo.createVehicle(
      vehicleInputSchema.parse({ name: 'Corolla', type: 'car', make: '', model: '', plate: '', first_registration: null, initial_km: 10000 }),
      '2026-10-01',
    );
    const fuel = (over: Record<string, unknown> = {}) =>
      fuelInputSchema.parse({ vehicle_id: v.id, filled_on: '2026-10-06', odometer_km: 105000, liters: 32.5, cost: 58.4, full_tank: true, notes: '', ...over });

    const id = await repo.createFuel(fuel()); // dedo de más: 105.000
    expect((await repo.currentKmByVehicle()).get(v.id)).toBe(105000);
    expect(await repo.listFuelLogs()).toMatchObject([{ centiliters: 3250, cost_cents: 5840, full_tank: 1 }]);

    await repo.updateFuel(id, fuel({ odometer_km: 10500 }));
    expect((await repo.currentKmByVehicle()).get(v.id)).toBe(10500);

    // La lectura de un repostaje no se borra suelta (se corrige con el repostaje).
    const reading = (await repo.listReadings(v.id)).find((r) => r.km === 10500)!;
    await repo.deleteReading(reading.id);
    expect((await repo.currentKmByVehicle()).get(v.id)).toBe(10500);

    const schema = MIGRATIONS.at(-1)!.version;
    const parsed = parseBackup(JSON.stringify(await repo.exportBackup(schema)), schema);
    expect(parsed.ok && parsed.backup.data.fuel_logs).toHaveLength(1);

    await repo.deleteFuel(id);
    expect(await repo.listFuelLogs()).toEqual([]);
    expect((await repo.currentKmByVehicle()).get(v.id)).toBe(10000);
  });
});

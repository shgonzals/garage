import { describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate } from '@/db/migrations';
import { GarageRepository } from '@/db/repository';
import { nextItvDate } from '@/domain/itv';
import { quickLogSchema, vehicleInputSchema } from '@/domain/schemas';
import { isRoadVehicle, tasksForType } from '@/domain/tasks';
import { openMemoryDatabase } from './helpers/sqljs';

describe('pit bike y kart', () => {
  it('migración 6: la tabla de vehículos admite los tipos nuevos sin perder datos ni claves foráneas', async () => {
    // Base de datos en la versión 5 con un vehículo y su historial.
    const db = await openMemoryDatabase();
    await db.exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);');
    const upTo5 = MIGRATIONS.filter((m) => m.version <= 5)
      .flatMap((m) => m.sql.split(';'))
      .map((s) => s.replace(/--.*$/gm, '').trim())
      .filter(Boolean)
      .map((sql) => ({ sql }));
    const ts = '2026-01-01T00:00:00.000Z';
    await db.batch([
      ...upTo5,
      { sql: "INSERT INTO schema_migrations VALUES (1,'x'),(2,'x'),(3,'x'),(4,'x'),(5,'x')" },
      { sql: `INSERT INTO vehicles (id, name, type, created_at, updated_at) VALUES ('v1', 'CBR', 'motorcycle', '${ts}', '${ts}')` },
      { sql: `INSERT INTO entries (id, vehicle_id, done_on, created_at, updated_at) VALUES ('e1', 'v1', '2026-01-01', '${ts}', '${ts}')` },
    ]);

    await migrate(db);
    const repo = new GarageRepository(db);
    expect((await repo.listVehicles()).map((v) => v.name)).toEqual(['CBR']);
    expect(await repo.listEntries('v1')).toHaveLength(1);

    const kart = await repo.createVehicle(
      vehicleInputSchema.parse({ name: 'Kart', type: 'kart', make: '', model: '', plate: '', first_registration: null, initial_km: null }),
      '2026-10-06',
    );
    expect(kart.type).toBe('kart');

    // Las claves foráneas siguen activas: un registro de un vehículo inexistente se rechaza.
    await expect(
      repo.createEntry(
        quickLogSchema.parse({ vehicle_id: 'no-existe', done_on: '2026-10-06', odometer_km: null, task_ids: ['oil'], cost: null, notes: '' }),
      ),
    ).rejects.toThrow();
  });

  it('no pasan ITV ni tienen tareas de carretera', () => {
    expect(nextItvDate('kart', '2020-01-01', null)).toBeNull();
    expect(nextItvDate('pitbike', null, '2025-01-01')).toBeNull();
    expect(isRoadVehicle('pitbike')).toBe(false);

    const kart = tasksForType('kart').map((t) => t.id);
    expect(kart).toEqual(expect.arrayContaining(['oil', 'chain_lube', 'chain_kit', 'tires', 'brake_pads']));
    expect(kart).not.toEqual(expect.arrayContaining(['itv']));
    expect(kart).not.toContain('fork_oil');
    expect(kart).not.toContain('timing_belt');

    const pit = tasksForType('pitbike').map((t) => t.id);
    expect(pit).toEqual(expect.arrayContaining(['fork_oil', 'chain_lube', 'clutch_fluid']));
    expect(pit).not.toContain('drive_belt');
    expect(pit).not.toContain('insurance');
  });
});

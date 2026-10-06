import { beforeEach, describe, expect, it } from 'vitest';
import { seedDemoData } from '@/db/demo';
import { MIGRATIONS, migrate } from '@/db/migrations';
import { GarageRepository } from '@/db/repository';
import type { SqlDatabase } from '@/db/sql';
import { summaryText } from '@/domain/format';
import { computeReminders, summarize } from '@/domain/reminders';
import { quickLogSchema, vehicleInputSchema } from '@/domain/schemas';
import { openMemoryDatabase } from './helpers/sqljs';

let db: SqlDatabase;
let repo: GarageRepository;

beforeEach(async () => {
  db = await openMemoryDatabase();
  await migrate(db);
  repo = new GarageRepository(db);
});

const newVehicle = (overrides: Record<string, unknown> = {}) =>
  vehicleInputSchema.parse({
    name: 'CBR600RR',
    type: 'motorcycle',
    make: 'Honda',
    model: '',
    plate: '1234 klm',
    first_registration: '2019-06-01',
    initial_km: 20000,
    ...overrides,
  });

describe('migraciones', () => {
  it('son idempotentes', async () => {
    await migrate(db);
    const rows = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM schema_migrations');
    expect(rows[0]?.n).toBe(MIGRATIONS.length);
  });

  it('una BD en la versión 1 recibe la columna de foto sin perder datos', async () => {
    const old = await openMemoryDatabase();
    await old.exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);');
    await old.batch([
      ...MIGRATIONS[0]!.sql.split(';').map((s) => s.replace(/--.*$/gm, '').trim()).filter(Boolean).map((sql) => ({ sql })),
      { sql: "INSERT INTO schema_migrations VALUES (1, '2026-01-01')" },
      {
        sql: "INSERT INTO vehicles (id, name, type, created_at, updated_at) VALUES ('v1', 'Vieja', 'car', '2026-01-01', '2026-01-01')",
      },
    ]);
    await migrate(old);
    const [v] = await new GarageRepository(old).listVehicles();
    expect(v?.name).toBe('Vieja');
    expect(v?.photo).toBeNull();
  });
});

describe('GarageRepository', () => {
  it('alta de vehículo con plan por defecto y lectura inicial', async () => {
    const v = await repo.createVehicle(newVehicle(), '2026-10-06');

    expect(v.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(v.plate).toBe('1234KLM');
    expect(v.model).toBeNull();
    expect(await repo.listVehicles()).toHaveLength(1);
    expect((await repo.currentKmByVehicle()).get(v.id)).toBe(20000);

    const tasks = (await repo.listSchedules(v.id)).map((s) => s.task_id).sort();
    expect(tasks).toContain('oil');
    expect(tasks).toContain('chain_lube');
    expect(tasks).not.toContain('timing_belt'); // solo coches
  });

  it('registro rápido: entry + tareas + km en una transacción', async () => {
    const v = await repo.createVehicle(newVehicle(), '2026-10-06');
    await repo.createEntry(
      quickLogSchema.parse({
        vehicle_id: v.id,
        done_on: '2026-10-06',
        odometer_km: 20500,
        task_ids: ['oil', 'air_filter'],
        cost: 120.5,
        notes: '  ',
      }),
    );

    const [e] = await repo.listEntries(v.id);
    expect(e).toMatchObject({ odometer_km: 20500, cost_cents: 12050, currency: 'EUR', notes: null });
    expect(e?.items.map((i) => i.task_id).sort()).toEqual(['air_filter', 'oil']);
    expect((await repo.currentKmByVehicle()).get(v.id)).toBe(20500);
  });

  it('una transacción fallida no deja nada a medias', async () => {
    await expect(
      repo.createEntry({
        vehicle_id: 'no-existe', // viola la FK
        done_on: '2026-10-06',
        odometer_km: 100,
        task_ids: ['oil'],
        cost: null,
        notes: null,
      }),
    ).rejects.toThrow();
    const rows = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM entry_items');
    expect(rows[0]?.n).toBe(0);
  });

  it('borrado lógico de entries y vehículos', async () => {
    const v = await repo.createVehicle(newVehicle(), '2026-10-06');
    const id = await repo.createEntry({ vehicle_id: v.id, done_on: '2026-10-06', odometer_km: null, task_ids: ['oil'], cost: null, notes: null });

    await repo.deleteEntry(id);
    expect(await repo.listEntries(v.id)).toEqual([]);
    const raw = await db.query<{ deleted_at: string | null }>('SELECT deleted_at FROM entry_items');
    expect(raw[0]?.deleted_at).not.toBeNull();

    await repo.deleteVehicle(v.id);
    expect(await repo.listVehicles()).toEqual([]);
    expect(await db.query('SELECT * FROM vehicles')).toHaveLength(1);
  });

  it('guarda, cambia y quita la foto del vehículo', async () => {
    const jpeg = 'data:image/jpeg;base64,/9j/AAAA';
    const v = await repo.createVehicle(newVehicle({ photo: jpeg }), '2026-10-06');
    expect((await repo.getVehicle(v.id))?.photo).toBe(jpeg);

    await repo.updateVehicle(v.id, newVehicle({ photo: null }));
    expect((await repo.getVehicle(v.id))?.photo).toBeNull();
  });

  it('rechaza una foto que no es imagen', () => {
    expect(vehicleInputSchema.safeParse({ ...newVehicle(), photo: 'https://example.com/x.jpg' }).success).toBe(false);
  });

  it('upsert de schedule', async () => {
    const v = await repo.createVehicle(newVehicle(), '2026-10-06');
    await repo.upsertSchedule(v.id, 'oil', { interval_km: 5000, interval_days: null, enabled: true });
    await repo.upsertSchedule(v.id, 'tires', { interval_km: 15000, interval_days: null, enabled: true });
    const byTask = new Map((await repo.listSchedules(v.id)).map((s) => [s.task_id, s]));
    expect(byTask.get('oil')).toMatchObject({ interval_km: 5000, interval_days: null, enabled: true });
    expect(byTask.get('tires')).toMatchObject({ interval_km: 15000 });
  });
});

describe('datos de ejemplo', () => {
  it('reproducen las tarjetas del mockup', async () => {
    const today = new Date(2026, 9, 6);
    await seedDemoData(repo, today);

    const [vehicles, schedules, entries, km] = await Promise.all([
      repo.listVehicles(),
      repo.listSchedules(),
      repo.listEntries(),
      repo.currentKmByVehicle(),
    ]);
    const cards = vehicles.map((vehicle) => {
      const s = summarize(
        computeReminders({
          vehicle,
          currentKm: km.get(vehicle.id) ?? null,
          schedules: schedules.filter((x) => x.vehicle_id === vehicle.id),
          entries: entries.filter((x) => x.vehicle_id === vehicle.id),
          today: '2026-10-06',
        }),
      );
      return [vehicle.name, km.get(vehicle.id), s.status, summaryText(s)];
    });

    expect(cards).toEqual([
      ['CBR600RR', 23050, 'overdue', '3 vencidos'],
      ['Scrambler', 8410, 'soon', 'Engrase de cadena en 90 km'],
      ['Corolla', 142300, 'ok', 'Al día'],
    ]);
  });
});

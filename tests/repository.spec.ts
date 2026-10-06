import { beforeEach, describe, expect, it } from 'vitest';
import { removeDemoData, seedDemoData } from '@/db/demo';
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
  it('enlaza las lecturas antiguas con su registro al migrar a la versión 3', async () => {
    const old = await openMemoryDatabase();
    await old.exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);');
    const v1v2 = MIGRATIONS.slice(0, 2)
      .flatMap((m) => m.sql.split(';'))
      .map((s) => s.replace(/--.*$/gm, '').trim())
      .filter(Boolean)
      .map((sql) => ({ sql }));
    const ts = '2026-05-01T10:00:00.000Z';
    await old.batch([
      ...v1v2,
      { sql: "INSERT INTO schema_migrations VALUES (1, '2026-01-01'), (2, '2026-01-01')" },
      { sql: `INSERT INTO vehicles (id, name, type, created_at, updated_at) VALUES ('v1', 'X', 'car', '${ts}', '${ts}')` },
      {
        sql: `INSERT INTO entries (id, vehicle_id, done_on, odometer_km, created_at, updated_at)
              VALUES ('e1', 'v1', '2026-05-01', 1500, '${ts}', '${ts}')`,
      },
      {
        sql: `INSERT INTO odometer_readings (id, vehicle_id, km, read_on, source, created_at, updated_at)
              VALUES ('r1', 'v1', 1500, '2026-05-01', 'entry', '${ts}', '${ts}'),
                     ('r0', 'v1', 1000, '2026-04-01', 'manual', '2026-04-01', '2026-04-01')`,
      },
    ]);
    await migrate(old);
    const readings = await new GarageRepository(old).listReadings('v1');
    expect(readings.map((r) => [r.id, r.entry_id])).toEqual([
      ['r1', 'e1'],
      ['r0', null],
    ]);
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

  it('editar un registro reemplaza tareas y km', async () => {
    const v = await repo.createVehicle(newVehicle({ initial_km: 20000 }), '2026-10-06');
    const log = (overrides: Record<string, unknown> = {}) =>
      quickLogSchema.parse({
        vehicle_id: v.id,
        done_on: '2026-10-06',
        odometer_km: 230500, // dedo de más
        task_ids: ['oil'],
        cost: 50,
        notes: '',
        ...overrides,
      });
    const id = await repo.createEntry(log());
    expect((await repo.currentKmByVehicle()).get(v.id)).toBe(230500);

    await repo.updateEntry(id, log({ odometer_km: 23050, task_ids: ['oil', 'air_filter'], cost: 65.5 }));

    const [entry] = await repo.listEntries(v.id);
    expect(entry?.odometer_km).toBe(23050);
    expect(entry?.cost_cents).toBe(6550);
    expect(entry?.items.map((i) => i.task_id).sort()).toEqual(['air_filter', 'oil']);
    expect((await repo.currentKmByVehicle()).get(v.id)).toBe(23050);
    expect((await repo.listReadings(v.id)).filter((r) => r.entry_id === id)).toHaveLength(1);
  });

  it('borrar un registro borra también su lectura de km', async () => {
    const v = await repo.createVehicle(newVehicle({ initial_km: 20000 }), '2026-10-06');
    const id = await repo.createEntry(
      quickLogSchema.parse({ vehicle_id: v.id, done_on: '2026-10-06', odometer_km: 230500, task_ids: ['oil'], cost: null, notes: '' }),
    );
    await repo.deleteEntry(id);
    expect((await repo.currentKmByVehicle()).get(v.id)).toBe(20000);
  });

  it('borrar una lectura manual corrige los km; las de un registro no se borran sueltas', async () => {
    const v = await repo.createVehicle(newVehicle({ initial_km: 20000 }), '2026-10-06');
    await repo.addOdometerReading(v.id, 200000, '2026-10-07');
    const entryId = await repo.createEntry(
      quickLogSchema.parse({ vehicle_id: v.id, done_on: '2026-10-08', odometer_km: 21000, task_ids: ['oil'], cost: null, notes: '' }),
    );
    const readings = await repo.listReadings(v.id);
    const typo = readings.find((r) => r.km === 200000)!;
    const fromEntry = readings.find((r) => r.entry_id === entryId)!;

    await repo.deleteReading(typo.id);
    await repo.deleteReading(fromEntry.id); // ignorada
    expect((await repo.currentKmByVehicle()).get(v.id)).toBe(21000);
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
  it('no se duplican y se pueden quitar sin tocar los vehículos del usuario', async () => {
    const mine = await repo.createVehicle(newVehicle({ plate: '0000XYZ' }), '2026-10-06');
    expect(await seedDemoData(repo)).toBe(true);
    expect(await seedDemoData(repo)).toBe(false);
    expect(await repo.listVehicles()).toHaveLength(4);

    expect(await removeDemoData(repo)).toBe(3);
    expect((await repo.listVehicles()).map((v) => v.id)).toEqual([mine.id]);
  });

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

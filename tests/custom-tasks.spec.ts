import { beforeEach, describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate } from '@/db/migrations';
import { GarageRepository } from '@/db/repository';
import { parseBackup } from '@/domain/backup';
import { computeReminders } from '@/domain/reminders';
import { customTaskInputSchema, quickLogSchema, vehicleInputSchema } from '@/domain/schemas';
import { getTask, registerCustomTasks } from '@/domain/tasks';
import { openMemoryDatabase } from './helpers/sqljs';

let repo: GarageRepository;
let vehicleId: string;

beforeEach(async () => {
  const db = await openMemoryDatabase();
  await migrate(db);
  repo = new GarageRepository(db);
  const v = await repo.createVehicle(
    vehicleInputSchema.parse({ name: 'Corolla', type: 'car', make: '', model: '', plate: '', first_registration: null, initial_km: 140000 }),
    '2026-10-06',
  );
  vehicleId = v.id;
});

const wipers = (over: Record<string, unknown> = {}) =>
  customTaskInputSchema.parse({ label: 'Escobillas', emoji: '🧽', interval_km: null, interval_days: 365, ...over });

describe('tareas personalizadas', () => {
  it('se crean con su intervalo y generan recordatorio como las demás', async () => {
    const task = await repo.createCustomTask(vehicleId, wipers());
    expect(task.id).toMatch(/^custom:[0-9a-f-]{36}$/);

    await repo.createEntry(
      quickLogSchema.parse({ vehicle_id: vehicleId, done_on: '2026-03-01', odometer_km: 141000, task_ids: [task.id], cost: 18, notes: '' }),
    );
    const [vehicle] = await repo.listVehicles();
    const reminders = computeReminders({
      vehicle: vehicle!,
      currentKm: 141000,
      today: '2026-10-06',
      schedules: await repo.listSchedules(vehicleId),
      entries: await repo.listEntries(vehicleId),
    });
    const r = reminders.find((x) => x.taskId === task.id);
    expect(r?.dueDate).toBe('2027-03-01');
    expect(r?.status).toBe('ok');
  });

  it('exige nombre e intervalo', () => {
    expect(customTaskInputSchema.safeParse({ label: ' ', emoji: '🔧', interval_km: 100, interval_days: null }).success).toBe(false);
    expect(customTaskInputSchema.safeParse({ label: 'Algo', emoji: '🔧', interval_km: null, interval_days: null }).success).toBe(false);
  });

  it('al borrarla sale del plan pero el historial conserva su nombre', async () => {
    const task = await repo.createCustomTask(vehicleId, wipers());
    await repo.createEntry(
      quickLogSchema.parse({ vehicle_id: vehicleId, done_on: '2026-03-01', odometer_km: null, task_ids: [task.id], cost: null, notes: '' }),
    );
    await repo.renameCustomTask(task.id, 'Escobillas delanteras', '🧽');
    await repo.deleteCustomTask(task.id);

    expect((await repo.listSchedules(vehicleId)).some((s) => s.task_id === task.id)).toBe(false);
    registerCustomTasks(await repo.listCustomTasks());
    const [entry] = await repo.listEntries(vehicleId);
    expect(getTask(entry!.items[0]!.task_id).label).toBe('Escobillas delanteras');
  });

  it('el registro rápido rechaza ids de tarea inventados', () => {
    const base = { vehicle_id: vehicleId, done_on: '2026-03-01', odometer_km: null, cost: null, notes: '' };
    expect(quickLogSchema.safeParse({ ...base, task_ids: ['custom:no-es-un-uuid'] }).success).toBe(false);
    expect(quickLogSchema.safeParse({ ...base, task_ids: ['inventada'] }).success).toBe(false);
  });

  it('viajan en la copia de seguridad', async () => {
    const task = await repo.createCustomTask(vehicleId, wipers());
    const schema = MIGRATIONS.at(-1)!.version;
    const parsed = parseBackup(JSON.stringify(await repo.exportBackup(schema)), schema);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const db = await openMemoryDatabase();
    await migrate(db);
    const target = new GarageRepository(db);
    await target.importBackup(parsed.backup);
    expect((await target.listCustomTasks()).map((t) => t.label)).toEqual(['Escobillas']);
    expect((await target.listSchedules()).some((s) => s.task_id === task.id)).toBe(true);
  });
});

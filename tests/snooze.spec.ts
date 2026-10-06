import { beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '@/db/migrations';
import { GarageRepository } from '@/db/repository';
import { planAlerts } from '@/domain/alerts';
import { computeReminders, summarize } from '@/domain/reminders';
import { quickLogSchema, vehicleInputSchema } from '@/domain/schemas';
import { applySnoozes, snoozeOptions, type Snooze } from '@/domain/snooze';
import { entry, schedule, vehicle } from './helpers/factories';
import { openMemoryDatabase } from './helpers/sqljs';

const TODAY = '2026-10-06';
const v = vehicle();
// Tensión de cadena cada 1.000 km, hecha a 22.000: a 23.050 está vencida (+50 km).
const overdue = () =>
  computeReminders({
    vehicle: v,
    currentKm: 23050,
    today: TODAY,
    schedules: [schedule('chain_tension', 1000, null)],
    entries: [entry('2026-08-18', 22000, ['chain_tension'])],
  });
const snooze = (over: Partial<Snooze> = {}): Snooze => ({
  vehicle_id: v.id,
  task_id: 'chain_tension',
  until_date: '2026-10-13',
  until_km: null,
  created_at: '2026-10-06T08:00:00.000Z',
  updated_at: '2026-10-06T08:00:00.000Z',
  deleted_at: null,
  ...over,
});

describe('posponer avisos', () => {
  it('un vencido aplazado pasa a "pospuesto" y deja de contar como vencido', () => {
    const [r] = applySnoozes(overdue(), [snooze()], 23050, TODAY);
    expect(r).toMatchObject({ status: 'snoozed', snoozedUntil: { date: '2026-10-13', km: null } });
    expect(summarize([r!]).overdue).toBe(0);
  });

  it('caduca al llegar la fecha o los km', () => {
    expect(applySnoozes(overdue(), [snooze()], 23050, '2026-10-13')[0]!.status).toBe('overdue');
    const byKm = snooze({ until_date: null, until_km: 23550 });
    expect(applySnoozes(overdue(), [byKm], 23400, TODAY)[0]!.status).toBe('snoozed');
    expect(applySnoozes(overdue(), [byKm], 23600, TODAY)[0]!.status).toBe('overdue');
  });

  it('si se registra la tarea después de aplazarla, el aplazamiento ya no aplica', () => {
    const done = computeReminders({
      vehicle: v,
      currentKm: 23050,
      today: TODAY,
      schedules: [schedule('chain_tension', 1000, null)],
      entries: [entry('2026-10-06', 23050, ['chain_tension'])],
    });
    expect(applySnoozes(done, [snooze()], 23050, TODAY)[0]!.status).toBe('ok');
  });

  it('opciones: por tiempo siempre; por km solo si la tarea va por km', () => {
    const labels = snoozeOptions(overdue()[0]!, 23050, TODAY).map((o) => o.label);
    expect(labels).toEqual(['1 semana', '2 semanas', '1 mes', '500 km más', '1.000 km más']);
    expect(snoozeOptions(overdue()[0]!, 23050, TODAY)[3]!.until).toEqual({ date: null, km: 23550 });
  });

  it('no avisa mientras está pospuesto, y avisa el día que termina', () => {
    const reminders = applySnoozes(overdue(), [snooze()], 23050, TODAY);
    const alerts = planAlerts([{ vehicle: v, reminders, rate: null, lastReadingDate: TODAY }], {
      now: new Date(2026, 9, 6, 8),
    });
    expect(alerts.some((a) => a.kind === 'overdue')).toBe(false);
    const end = alerts.find((a) => a.kind === 'snooze');
    expect(end?.at.getDate()).toBe(13);
  });
});

describe('aplazamientos en la base de datos', () => {
  let repo: GarageRepository;
  beforeEach(async () => {
    const db = await openMemoryDatabase();
    await migrate(db);
    repo = new GarageRepository(db);
  });

  it('aplazar, cambiar y quitar', async () => {
    const car = await repo.createVehicle(
      vehicleInputSchema.parse({ name: 'X', type: 'car', make: '', model: '', plate: '', first_registration: null, initial_km: 1000 }),
      TODAY,
    );
    await repo.snooze(car.id, 'oil', { date: '2026-10-13', km: null });
    await repo.snooze(car.id, 'oil', { date: null, km: 1500 });
    expect(await repo.listSnoozes()).toMatchObject([{ task_id: 'oil', until_date: null, until_km: 1500 }]);
    await repo.unsnooze(car.id, 'oil');
    expect(await repo.listSnoozes()).toEqual([]);
    // El registro de la tarea sigue funcionando con el aplazamiento puesto (no hay dependencia).
    await repo.snooze(car.id, 'oil', { date: '2026-10-13', km: null });
    await repo.createEntry(
      quickLogSchema.parse({ vehicle_id: car.id, done_on: TODAY, odometer_km: null, task_ids: ['oil'], cost: null, notes: '' }),
    );
  });
});

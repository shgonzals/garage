import { describe, expect, it } from 'vitest';
import { computeReminders, findLastDone, summarize } from '@/domain/reminders';
import { entry, schedule, vehicle } from './helpers/factories';

const TODAY = '2026-10-06';

describe('findLastDone', () => {
  it('coge la entry más reciente que contiene la tarea, ignorando borradas', () => {
    const entries = [
      entry('2026-01-01', 10000, ['oil']),
      entry('2026-05-01', 12000, ['oil', 'chain_lube']),
      entry('2026-08-01', 14000, ['oil'], { deleted_at: '2026-08-02T00:00:00Z' }),
      entry('2026-09-01', 15000, ['chain_lube']),
    ];
    expect(findLastDone(entries, 'oil')).toEqual({ date: '2026-05-01', km: 12000 });
    expect(findLastDone(entries, 'chain_lube')).toEqual({ date: '2026-09-01', km: 15000 });
    expect(findLastDone(entries, 'brake_fluid')).toBeNull();
  });
});

describe('computeReminders', () => {
  const base = { vehicle: vehicle(), currentKm: 23050, today: TODAY };

  it('aceite: al día con 1.150 km de margen y fecha lejana', () => {
    const [r] = computeReminders({
      ...base,
      schedules: [schedule('oil', 6000, 365)],
      entries: [entry('2026-03-14', 18200, ['oil'])],
    });
    expect(r).toMatchObject({ status: 'ok', dueKm: 24200, remainingKm: 1150, dueDate: '2027-03-14', trigger: 'km' });
  });

  it('pronto cuando queda menos del 20 % del intervalo', () => {
    const [r] = computeReminders({
      ...base,
      currentKm: 8410,
      schedules: [schedule('chain_lube', 500, null)],
      entries: [entry('2026-09-20', 8000, ['chain_lube'])],
    });
    expect(r).toMatchObject({ status: 'soon', remainingKm: 90 });
  });

  it('el margen de aviso tiene tope de 1.000 km', () => {
    const [r] = computeReminders({
      ...base,
      currentKm: 148_500,
      schedules: [schedule('oil', 15000, null)],
      entries: [entry('2026-09-01', 135_000, ['oil'])],
    });
    expect(r).toMatchObject({ status: 'ok', remainingKm: 1500 });
  });

  it('vencido por km', () => {
    const [r] = computeReminders({
      ...base,
      schedules: [schedule('chain_tension', 1000, null)],
      entries: [entry('2026-08-18', 22000, ['chain_tension'])],
    });
    expect(r).toMatchObject({ status: 'overdue', remainingKm: -50, trigger: 'km' });
  });

  it('vencido por fecha aunque sobren km', () => {
    const [r] = computeReminders({
      ...base,
      schedules: [schedule('brake_fluid', null, 730)],
      entries: [entry('2024-10-02', 15800, ['brake_fluid'])],
    });
    expect(r).toMatchObject({ status: 'overdue', dueDate: '2026-10-02', remainingDays: -4, trigger: 'days' });
  });

  it('pronto por fecha (aviso de 30 días como máximo)', () => {
    const [r] = computeReminders({
      ...base,
      schedules: [schedule('oil', 6000, 365)],
      entries: [entry('2025-10-20', 22500, ['oil'])],
    });
    expect(r).toMatchObject({ status: 'soon', remainingDays: 14, trigger: 'days' });
  });

  it('sin historial → unknown', () => {
    const [r] = computeReminders({ ...base, schedules: [schedule('valves', 24000, null)], entries: [] });
    expect(r).toMatchObject({ status: 'unknown', last: null });
  });

  it('sin km actuales, una tarea solo por km queda unknown', () => {
    const [r] = computeReminders({
      ...base,
      currentKm: null,
      schedules: [schedule('chain_lube', 500, null)],
      entries: [entry('2026-09-20', 8000, ['chain_lube'])],
    });
    expect(r?.status).toBe('unknown');
  });

  it('ignora schedules desactivados o sin intervalos', () => {
    const rs = computeReminders({
      ...base,
      schedules: [schedule('oil', 6000, 365, { enabled: false }), schedule('tires', null, null)],
      entries: [],
    });
    expect(rs).toEqual([]);
  });

  it('añade la ITV calculada y ordena por urgencia', () => {
    const rs = computeReminders({
      ...base,
      vehicle: vehicle({ first_registration: '2019-06-01' }),
      schedules: [schedule('oil', 6000, 365), schedule('chain_tension', 1000, null), schedule('valves', 24000, null)],
      entries: [
        entry('2026-03-14', 18200, ['oil']),
        entry('2026-08-18', 22000, ['chain_tension']),
        entry('2024-10-20', 14000, ['itv']),
      ],
    });
    expect(rs.map((r) => [r.taskId, r.status])).toEqual([
      ['chain_tension', 'overdue'],
      ['itv', 'soon'],
      ['oil', 'ok'],
      ['valves', 'unknown'],
    ]);
    expect(rs.find((r) => r.taskId === 'itv')).toMatchObject({ dueDate: '2026-10-20', remainingDays: 14 });
  });
});

describe('ITV', () => {
  const itv = (first_registration: string, entries: ReturnType<typeof entry>[] = []) =>
    computeReminders({ vehicle: vehicle({ type: 'van', first_registration }), currentKm: null, schedules: [], entries, today: TODAY })[0];

  it('vehículo nuevo: cuenta desde la matriculación', () => {
    expect(itv('2025-01-15')).toMatchObject({ status: 'ok', dueDate: '2027-01-15', last: null });
  });

  it('vehículo antiguo sin ITV registrada: unknown, no vencida', () => {
    expect(itv('2014-03-01')).toMatchObject({ status: 'unknown' });
  });

  it('con ITV registrada vencida: overdue', () => {
    expect(itv('2014-03-01', [entry('2025-03-01', null, ['itv'])])).toMatchObject({ status: 'overdue', dueDate: '2025-09-01' });
  });
});

describe('summarize', () => {
  it('cuenta vencidos y expone el más urgente', () => {
    const rs = computeReminders({
      vehicle: vehicle(),
      currentKm: 23050,
      today: TODAY,
      schedules: [schedule('chain_tension', 1000, null), schedule('brake_fluid', null, 730), schedule('oil', 6000, 365)],
      entries: [
        entry('2026-08-18', 22000, ['chain_tension']),
        entry('2024-10-02', 15800, ['brake_fluid']),
        entry('2026-03-14', 18200, ['oil']),
      ],
    });
    expect(summarize(rs)).toMatchObject({ status: 'overdue', overdue: 2, soon: 0 });
  });

  it('sin recordatorios → unknown', () => {
    expect(summarize([])).toMatchObject({ status: 'unknown', top: null, overdue: 0 });
  });
});

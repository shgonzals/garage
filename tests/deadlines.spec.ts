import { describe, expect, it } from 'vitest';
import { nextAnnualDue } from '@/domain/deadlines';
import { computeReminders } from '@/domain/reminders';
import { entry, vehicle } from './helpers/factories';

describe('vencimientos anuales (seguro, impuesto)', () => {
  it('sin renovaciones: la fecha indicada', () => {
    expect(nextAnnualDue('2026-11-15', [])).toBe('2026-11-15');
  });

  it('renovar unos días antes no adelanta el siguiente vencimiento', () => {
    expect(nextAnnualDue('2026-11-15', ['2026-11-02'])).toBe('2027-11-15');
  });

  it('renovar tarde también cuenta para ese periodo', () => {
    expect(nextAnnualDue('2026-11-15', ['2026-12-01'])).toBe('2027-11-15');
  });

  it('varias renovaciones encadenadas', () => {
    expect(nextAnnualDue('2024-11-15', ['2024-11-10', '2025-11-12'])).toBe('2026-11-15');
  });

  it('una renovación muy anterior (otra póliza) no cuenta', () => {
    expect(nextAnnualDue('2026-11-15', ['2026-03-01'])).toBe('2026-11-15');
  });

  it('sin fecha indicada: la última renovación + 1 año', () => {
    expect(nextAnnualDue(null, ['2026-02-10'])).toBe('2027-02-10');
    expect(nextAnnualDue(null, [])).toBeNull();
  });

  it('genera recordatorio "pronto" un mes antes y se renueva registrándolo', () => {
    const v = vehicle({ insurance_due: '2026-10-26', road_tax_due: '2027-03-01' });
    const before = computeReminders({ vehicle: v, currentKm: null, today: '2026-10-06', schedules: [], entries: [] });
    const insurance = before.find((r) => r.taskId === 'insurance');
    expect(insurance).toMatchObject({ status: 'soon', dueDate: '2026-10-26', remainingDays: 20 });
    expect(before.find((r) => r.taskId === 'road_tax')?.status).toBe('ok');

    const after = computeReminders({
      vehicle: v,
      currentKm: null,
      today: '2026-10-06',
      schedules: [],
      entries: [entry('2026-10-06', null, ['insurance'])],
    });
    expect(after.find((r) => r.taskId === 'insurance')).toMatchObject({ status: 'ok', dueDate: '2027-10-26' });
  });

  it('sin fecha ni renovaciones no hay recordatorio', () => {
    const reminders = computeReminders({ vehicle: vehicle(), currentKm: null, today: '2026-10-06', schedules: [], entries: [] });
    expect(reminders.some((r) => r.taskId === 'insurance' || r.taskId === 'road_tax')).toBe(false);
  });
});

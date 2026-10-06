import { describe, expect, it } from 'vitest';
import { formatRate, reminderGauge, reminderHeadline } from '@/domain/format';
import { suspiciousReadings } from '@/domain/odometer';
import { computeReminders } from '@/domain/reminders';
import { snoozeOptions } from '@/domain/snooze';
import { defaultSchedulesFor } from '@/domain/tasks';
import { UNITS, usageUnit } from '@/domain/units';
import { entry, schedule, vehicle } from './helpers/factories';

describe('horas de motor (pit bike y kart)', () => {
  const kart = vehicle({ type: 'kart', name: 'Kart' });
  // Aceite cada 10 h, cambiado a las 40 h; ahora lleva 48 h → quedan 2 h ("pronto").
  const [oil] = computeReminders({
    vehicle: kart,
    currentKm: 48,
    today: '2026-10-06',
    schedules: [schedule('oil', 10, null, { vehicle_id: kart.id })],
    entries: [entry('2026-09-01', 40, ['oil'])],
  });

  it('pit bike y kart usan horas; el resto, km', () => {
    expect(usageUnit('kart')).toBe('h');
    expect(usageUnit('pitbike')).toBe('h');
    expect(usageUnit('motorcycle')).toBe('km');
    expect(oil!.unit).toBe('h');
  });

  it('textos e indicador en horas', () => {
    expect(reminderHeadline(oil!)).toBe('2 h · Toca a 50 h');
    expect(reminderGauge(oil!)).toMatchObject({ value: '2', unit: 'h' });
  });

  it('posponer por horas', () => {
    const labels = snoozeOptions(oil!, 48, '2026-10-06').map((o) => o.label);
    expect(labels).toContain('5 h más');
    expect(labels).toContain('10 h más');
  });

  it('más de 24 h en un día es un error al teclear', () => {
    const readings = [
      { id: 'a', read_on: '2026-10-01', km: 40 },
      { id: 'b', read_on: '2026-10-02', km: 480 }, // 440 h en un día
    ];
    expect(suspiciousReadings(readings, UNITS.h.maxPerDay).has('b')).toBe(true);
    expect(suspiciousReadings(readings).has('b')).toBe(false); // en km sería plausible
  });

  it('ritmo en horas por semana', () => {
    expect(formatRate(0.5, 'h')).toBe('3,5 h/semana');
    expect(formatRate(17.4, 'km')).toBe('17 km/día');
  });

  it('un kart nuevo trae un plan básico en horas', () => {
    const plan = new Map(defaultSchedulesFor('kart').map((d) => [d.taskId, d.interval]));
    expect(plan.get('oil')).toEqual({ km: 10, days: 365 });
    expect(plan.get('chain_lube')).toEqual({ km: 2, days: null });
    expect(plan.has('timing_belt')).toBe(false);
  });
});

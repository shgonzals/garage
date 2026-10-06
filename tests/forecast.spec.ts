import { describe, expect, it } from 'vitest';
import { dateForKm, estimateKmRate, estimatedKmDueDate } from '@/domain/forecast';
import { computeReminders } from '@/domain/reminders';
import { entry, schedule, vehicle } from './helpers/factories';

const r = (id: string, read_on: string, km: number) => ({ id, read_on, km });

describe('ritmo de km', () => {
  it('km entre la primera y la última lectura del último año', () => {
    const rate = estimateKmRate([r('a', '2026-01-01', 10000), r('b', '2026-04-11', 14000)]);
    expect(rate?.perDay).toBe(40); // 4.000 km en 100 días
    expect(rate?.lastDate).toBe('2026-04-11');
  });

  it('ignora lo anterior a un año y las lecturas erróneas', () => {
    const rate = estimateKmRate([
      r('viejo', '2024-01-01', 1000),
      r('a', '2026-01-01', 10000),
      r('typo', '2026-02-01', 120000),
      r('b', '2026-04-11', 14000),
    ]);
    expect(rate?.perDay).toBe(40);
  });

  it('sin datos suficientes no inventa', () => {
    expect(estimateKmRate([])).toBeNull();
    expect(estimateKmRate([r('a', '2026-01-01', 10000)])).toBeNull();
    expect(estimateKmRate([r('a', '2026-01-01', 10000), r('b', '2026-01-05', 10300)])).toBeNull(); // < 14 días
    expect(estimateKmRate([r('a', '2026-01-01', 10000), r('b', '2026-03-01', 10000)])).toBeNull(); // parado
  });

  it('fecha para unos km, desde la última lectura', () => {
    const rate = { perDay: 40, lastDate: '2026-10-01', lastKm: 23000 };
    expect(dateForKm(rate, 24200, '2026-10-06')).toBe('2026-10-31'); // 1.200 km / 40 = 30 días
    expect(dateForKm(rate, 23100, '2026-10-06')).toBe('2026-10-06'); // ya debería haber llegado: hoy
  });

  it('solo estima cuando los km llegan antes que la fecha límite', () => {
    const v = vehicle();
    const [oil] = computeReminders({
      vehicle: v,
      currentKm: 23050,
      today: '2026-10-06',
      schedules: [schedule('oil', 6000, 365)],
      entries: [entry('2026-03-14', 18200, ['oil'])],
    });
    const fast = { perDay: 40, lastDate: '2026-10-06', lastKm: 23050 };
    const slow = { perDay: 1, lastDate: '2026-10-06', lastKm: 23050 };
    expect(estimatedKmDueDate(oil!, fast, '2026-10-06')).toBe('2026-11-04'); // 1.150 / 40 → 29 días
    expect(estimatedKmDueDate(oil!, slow, '2026-10-06')).toBeNull(); // antes llega el 14 mar 2027
  });
});

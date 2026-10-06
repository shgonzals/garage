import { describe, expect, it } from 'vitest';
import { suspiciousReadings } from '@/domain/odometer';

const r = (id: string, read_on: string, km: number) => ({ id, read_on, km });

describe('suspiciousReadings', () => {
  it('sin contradicciones no marca nada', () => {
    expect(suspiciousReadings([r('a', '2026-01-01', 1000), r('b', '2026-02-01', 2000)]).size).toBe(0);
  });

  it('marca el dedo de más: mayor que una lectura posterior', () => {
    const out = suspiciousReadings([
      r('a', '2026-01-01', 22000),
      r('typo', '2026-02-01', 230500),
      r('c', '2026-03-01', 23200),
    ]);
    expect([...out]).toEqual(['typo']);
  });

  it('el mismo día no se contradice', () => {
    expect(suspiciousReadings([r('a', '2026-01-01', 1200), r('b', '2026-01-01', 1000)]).size).toBe(0);
  });

  it('marca la última lectura si el salto es imposible (> 1.500 km/día)', () => {
    const out = suspiciousReadings([r('a', '2026-10-06', 23100), r('typo', '2026-10-06', 231000)]);
    expect([...out]).toEqual(['typo']);
  });

  it('un viaje largo no es sospechoso', () => {
    // 1.200 km en un día, o 20.000 km en un mes: plausibles.
    expect(suspiciousReadings([r('a', '2026-07-01', 10000), r('b', '2026-07-02', 11200)]).size).toBe(0);
    expect(suspiciousReadings([r('a', '2026-07-01', 10000), r('b', '2026-08-01', 30000)]).size).toBe(0);
  });
});

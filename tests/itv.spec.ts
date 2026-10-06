import { describe, expect, it } from 'vitest';
import { itvIntervalMonths, nextItvDate } from '@/domain/itv';

describe('nextItvDate', () => {
  it('sin datos no calcula nada', () => {
    expect(nextItvDate('car', null, null)).toBeNull();
  });

  it('primera ITV tras el periodo de exención de cada tipo', () => {
    expect(nextItvDate('car', '2022-05-10', null)).toBe('2026-05-10');
    expect(nextItvDate('motorcycle', '2022-05-10', null)).toBe('2026-05-10');
    expect(nextItvDate('moped', '2022-05-10', null)).toBe('2025-05-10');
    expect(nextItvDate('van', '2022-05-10', null)).toBe('2024-05-10');
  });

  it('turismo: bienal hasta los 10 años, luego anual', () => {
    expect(nextItvDate('car', '2016-03-01', '2024-03-01')).toBe('2026-03-01'); // 8 años → +2
    expect(nextItvDate('car', '2016-03-01', '2026-03-01')).toBe('2027-03-01'); // 10 años → +1
  });

  it('redondea la antigüedad: pasar la ITV unas semanas antes del aniversario cuenta como ese año', () => {
    // 9 años y 11 meses → 10 años → anual
    expect(nextItvDate('car', '2016-03-01', '2026-01-28')).toBe('2027-01-28');
  });

  it('moto: siempre bienal', () => {
    expect(nextItvDate('motorcycle', '2010-01-01', '2025-06-01')).toBe('2027-06-01');
  });

  it('furgoneta: bienal → anual → semestral', () => {
    expect(itvIntervalMonths('van', 4)).toBe(24);
    expect(itvIntervalMonths('van', 7)).toBe(12);
    expect(itvIntervalMonths('van', 11)).toBe(6);
    expect(nextItvDate('van', '2014-01-01', '2025-01-10')).toBe('2025-07-10');
  });

  it('sin fecha de matriculación usa la última ITV con el intervalo inicial', () => {
    expect(nextItvDate('car', null, '2025-06-01')).toBe('2027-06-01');
  });
});

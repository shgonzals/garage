import { describe, expect, it } from 'vitest';
import { formatDate, formatKm, formatMoney, reminderHeadline, reminderLastLine, summaryText } from '@/domain/format';
import { computeReminders, summarize } from '@/domain/reminders';
import { eurosToCents } from '@/domain/schemas';
import { entry, schedule, vehicle } from './helpers/factories';

const TODAY = '2026-10-06';
const one = (s: ReturnType<typeof schedule>, e: ReturnType<typeof entry>[], currentKm = 23050) =>
  computeReminders({ vehicle: vehicle(), currentKm, today: TODAY, schedules: [s], entries: e })[0]!;

describe('formato es-ES', () => {
  it('agrupa miles también con 4 cifras', () => {
    expect(formatKm(8410)).toBe('8.410 km');
    expect(formatKm(142300)).toBe('142.300 km');
  });

  it('fechas cortas en castellano', () => {
    expect(formatDate('2026-10-02')).toBe('2 oct 2026');
    expect(formatDate('2027-03-14')).toBe('14 mar 2027');
  });

  it('dinero en céntimos', () => {
    expect(eurosToCents(120.5)).toBe(12050);
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
    expect(formatMoney(12050)).toMatch(/120,50\s€/);
  });
});

describe('textos de recordatorio (como en el mockup)', () => {
  it('al día', () => {
    const r = one(schedule('oil', 6000, 365), [entry('2026-03-14', 18200, ['oil'])]);
    expect(reminderHeadline(r)).toBe('1.150 km · Toca a 24.200 km o antes del 14 mar 2027');
    expect(reminderLastLine(r)).toBe('Último: 18.200 km, 14 mar 2026');
  });

  it('vencido por km', () => {
    const r = one(schedule('chain_tension', 1000, null), [entry('2026-08-18', 22000, ['chain_tension'])]);
    expect(reminderHeadline(r)).toBe('+50 km · Tocaba a 23.000 km');
  });

  it('vencido por fecha', () => {
    const r = one(schedule('brake_fluid', null, 730), [entry('2024-10-02', null, ['brake_fluid'])]);
    expect(reminderHeadline(r)).toBe('Vencido · Tocaba el 2 oct 2026');
    expect(reminderLastLine(r)).toBe('Último: 2 oct 2024');
  });

  it('sin historial', () => {
    const r = one(schedule('oil', 6000, 365), []);
    expect(reminderHeadline(r)).toBe('Sin registro previo · cada 6.000 km o cada 1 año');
  });
});

describe('resumen de la tarjeta del vehículo', () => {
  it('pronto: nombra la tarea y lo que falta', () => {
    const rs = computeReminders({
      vehicle: vehicle(),
      currentKm: 8410,
      today: TODAY,
      schedules: [schedule('chain_lube', 500, null)],
      entries: [entry('2026-09-20', 8000, ['chain_lube'])],
    });
    expect(summaryText(summarize(rs))).toBe('Engrase de cadena en 90 km');
  });

  it('vencidos en plural', () => {
    const rs = computeReminders({
      vehicle: vehicle(),
      currentKm: 23050,
      today: TODAY,
      schedules: [schedule('chain_tension', 1000, null), schedule('brake_fluid', null, 730)],
      entries: [entry('2026-08-18', 22000, ['chain_tension']), entry('2024-10-02', 15800, ['brake_fluid'])],
    });
    expect(summaryText(summarize(rs))).toBe('2 vencidos');
  });

  it('al día', () => {
    const rs = computeReminders({
      vehicle: vehicle(),
      currentKm: 20000,
      today: TODAY,
      schedules: [schedule('oil', 6000, 365)],
      entries: [entry('2026-09-01', 19000, ['oil'])],
    });
    expect(summaryText(summarize(rs))).toBe('Al día');
  });
});

import { describe, expect, it } from 'vitest';
import { alertId, planAlerts, type AlertVehicle } from '@/domain/alerts';
import { computeReminders } from '@/domain/reminders';
import { entry, schedule, vehicle } from './helpers/factories';

// Martes 6 oct 2026, 08:00 (hora local).
const NOW = new Date(2026, 9, 6, 8, 0);
const TODAY = '2026-10-06';

function input(over: Partial<AlertVehicle> & { schedules: ReturnType<typeof schedule>[]; entries: ReturnType<typeof entry>[]; km: number }): AlertVehicle {
  const v = vehicle();
  return {
    vehicle: v,
    reminders: computeReminders({ vehicle: v, currentKm: over.km, today: TODAY, schedules: over.schedules, entries: over.entries }),
    rate: over.rate ?? null,
    lastReadingDate: over.lastReadingDate ?? TODAY,
  };
}

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.getHours()}h`;

describe('plan de avisos', () => {
  it('por fecha: "se acerca" al entrar en pronto y "toca" el día que vence', () => {
    // Líquido de frenos cada 2 años, hecho el 1 dic 2024 → vence el 1 dic 2026; pronto 30 días antes.
    const alerts = planAlerts([input({ km: 23000, schedules: [schedule('brake_fluid', null, 730)], entries: [entry('2024-12-01', 16000, ['brake_fluid'])] })], { now: NOW });
    const brake = alerts.filter((a) => a.kind !== 'odometer');
    expect(brake.map((a) => [a.kind, day(a.at)])).toEqual([
      ['soon', '2026-11-01 10h'],
      ['due', '2026-12-01 10h'],
    ]);
    expect(brake[0]!.body).toBe('Se acerca: toca antes del 1 dic 2026.');
  });

  it('por km: usa el ritmo para fechar el aviso', () => {
    // Aceite cada 6.000 km hecho a 18.200 → toca a 24.200; vas a 23.050 a 40 km/día → 29 días.
    const alerts = planAlerts(
      [
        input({
          km: 23050,
          schedules: [schedule('oil', 6000, null)],
          entries: [entry('2026-03-14', 18200, ['oil'])],
          rate: { perDay: 40, lastDate: TODAY, lastKm: 23050 },
        }),
      ],
      { now: NOW },
    );
    const due = alerts.find((a) => a.kind === 'due');
    expect(day(due!.at)).toBe('2026-11-04 10h');
    expect(due!.body).toMatch(/A tu ritmo ya rondarás los 24\.200 km/);
  });

  it('vencidos: un resumen semanal el sábado, no avisos diarios', () => {
    const alerts = planAlerts(
      [input({ km: 23050, schedules: [schedule('chain_tension', 1000, null)], entries: [entry('2026-08-18', 22000, ['chain_tension'])] })],
      { now: NOW },
    );
    const overdue = alerts.filter((a) => a.kind === 'overdue');
    expect(overdue).toHaveLength(1);
    expect(day(overdue[0]!.at)).toBe('2026-10-10 10h'); // sábado
    expect(overdue[0]!.title).toBe('CBR600RR · 1 mantenimiento vencido');
  });

  it('odómetro: pide los km tres semanas después de la última lectura', () => {
    const alerts = planAlerts(
      [input({ km: 23050, schedules: [schedule('oil', 6000, null)], entries: [entry('2026-03-14', 18200, ['oil'])], lastReadingDate: '2026-10-01' })],
      { now: NOW },
    );
    const odo = alerts.find((a) => a.kind === 'odometer');
    expect(day(odo!.at)).toBe('2026-10-22 19h');
    expect(odo!.body).toMatch(/Hace 21 días/);
  });

  it('odómetro ya atrasado: el domingo siguiente', () => {
    const alerts = planAlerts(
      [input({ km: 23050, schedules: [schedule('oil', 6000, null)], entries: [entry('2026-03-14', 18200, ['oil'])], lastReadingDate: '2026-08-01' })],
      { now: NOW },
    );
    expect(day(alerts.find((a) => a.kind === 'odometer')!.at)).toBe('2026-10-11 19h');
  });

  it('ids estables y distintos por tarea y tipo', () => {
    expect(alertId('due:v1:oil')).toBe(alertId('due:v1:oil'));
    expect(alertId('due:v1:oil')).not.toBe(alertId('soon:v1:oil'));
    expect(alertId('due:v1:oil')).toBeGreaterThan(0);
    expect(alertId('due:v1:oil')).toBeLessThan(2 ** 31);
  });

  it('nada fuera del horizonte ni en el pasado', () => {
    const alerts = planAlerts(
      [input({ km: 23000, schedules: [schedule('timing_belt', null, 3650)], entries: [entry('2025-09-01', 20000, ['timing_belt'])] })],
      { now: NOW },
    );
    expect(alerts.filter((a) => a.kind !== 'odometer')).toHaveLength(0);
  });
});

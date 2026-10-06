import { afterEach, describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatNumber, parseDecimal, reminderHeadline } from '@/domain/format';
import { snoozeOptions } from '@/domain/snooze';
import { getTask, VEHICLE_TYPES } from '@/domain/tasks';
import type { Reminder } from '@/domain/reminders';
import { i18n, systemLocale } from '@/i18n';
import en from '@/i18n/en';
import es from '@/i18n/es';

const reminder: Reminder = {
  vehicleId: 'v1', taskId: 'oil', status: 'soon', unit: 'km', trigger: 'km', intervalKm: 6000, intervalDays: 365,
  dueKm: 24200, dueDate: '2027-03-14', remainingKm: 1150, remainingDays: 160, progress: 0.8,
  last: { km: 18200, date: '2026-03-14' },
} as unknown as Reminder;

/** Rutas de todas las hojas de un objeto de mensajes ("a.b.c"). */
function keys(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe('idiomas', () => {
  afterEach(() => {
    i18n.global.locale.value = 'es';
  });

  it('inglés tiene exactamente las mismas claves que español', () => {
    expect(keys(en).sort()).toEqual(keys(es).sort());
  });

  it('el mismo singular/plural en los dos idiomas', () => {
    const pipes = (o: object) => Object.fromEntries(keys(o).map((k) => [k, k.split('.').reduce((x: any, p) => x[p], o).split('|').length]));
    expect(pipes(en)).toEqual(pipes(es));
  });

  it('idioma del sistema: español solo si el móvil está en español', () => {
    expect(systemLocale(['es-ES'])).toBe('es');
    expect(systemLocale(['es-MX', 'en'])).toBe('es');
    expect(systemLocale(['en-GB'])).toBe('en');
    expect(systemLocale(['fr-FR'])).toBe('en');
  });

  it('textos, fechas y cifras cambian con el idioma', () => {
    expect(reminderHeadline(reminder)).toBe('1.150 km · Toca a 24.200 km o antes del 14 mar 2027');
    expect(getTask('oil').label).toBe('Aceite y filtro');

    i18n.global.locale.value = 'en';
    expect(reminderHeadline(reminder)).toBe('1,150 km · Due at 24,200 km or before 14 Mar 2027');
    expect(getTask('oil').label).toBe('Oil and filter');
    expect(VEHICLE_TYPES.find((v) => v.id === 'car')!.label).toBe('Car');
    expect(formatNumber(8410)).toBe('8,410');
    expect(formatMoney(123456)).toBe('€1,234.56');
    expect(formatDate('2026-10-02')).toBe('2 Oct 2026');
    expect(snoozeOptions(reminder, 23050, '2026-10-06').map((o) => o.label)).toEqual([
      '1 week', '2 weeks', '1 month', '500 km more', '1,000 km more',
    ]);
  });

  it('las cifras escritas a mano valen con coma o con punto', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal('1.234,50')).toBe(1234.5);
    expect(parseDecimal('1,234.50')).toBe(1234.5);
    expect(parseDecimal('')).toBeNull();
  });
});

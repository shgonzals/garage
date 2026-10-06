import { afterEach, describe, expect, it } from 'vitest';
import { widgetPayload } from '@/domain/widget';
import type { Reminder } from '@/domain/reminders';
import type { Vehicle } from '@/domain/types';
import { i18n } from '@/i18n';
import { widgetRoute } from '@/lib/widget';

const vehicle = { id: 'v1', name: 'CBR600RR', type: 'motorcycle' } as Vehicle;
const r = (taskId: string, status: Reminder['status'], over: Partial<Reminder> = {}) =>
  ({
    vehicleId: 'v1', taskId, status, unit: 'km', trigger: 'km', intervalKm: 1000, intervalDays: null,
    dueKm: 23000, dueDate: null, remainingKm: status === 'overdue' ? -50 : 300, remainingDays: null, progress: 0.9, last: null,
    ...over,
  }) as unknown as Reminder;

describe('widget', () => {
  afterEach(() => {
    i18n.global.locale.value = 'es';
  });

  it('las 3 tareas más urgentes, sin pospuestas ni sin historial, con textos absolutos', () => {
    const p = widgetPayload([vehicle], [
      r('chain_tension', 'overdue'),
      r('brake_fluid', 'snoozed'),
      r('oil', 'soon'),
      r('coolant', 'ok', { trigger: 'days', dueKm: null, dueDate: '2027-03-14', remainingKm: null, remainingDays: 160 }),
      r('valves', 'ok'),
      r('battery', 'unknown'),
    ]);
    expect(p.items.map((i) => [i.title, i.subtitle, i.tone])).toEqual([
      ['CBR600RR · Tensión de cadena', '+50 km · Tocaba a 23.000 km', 'danger'],
      ['CBR600RR · Aceite y filtro', 'Toca a 23.000 km', 'warning'],
      ['CBR600RR · Refrigerante', 'Toca antes del 14 mar 2027', 'success'],
    ]);
    expect(p.quickLog).toBe('Registrar');
  });

  it('sin tareas o sin vehículos: mensaje para el widget, en el idioma de la app', () => {
    expect(widgetPayload([vehicle], []).empty).toBe('Todo al día ✓');
    i18n.global.locale.value = 'en';
    expect(widgetPayload([], [])).toEqual({ quickLog: 'Log', empty: 'Add a vehicle in Garage', items: [], open: '/tabs/reminders' });
    expect(widgetPayload([vehicle], [r('oil', 'overdue')], false)).toMatchObject({ quickLog: '', items: [], open: '/pro?from=widget' });
  });

  it('enlaces del widget', () => {
    expect(widgetRoute('garage://open/log')).toBe('/log');
    expect(widgetRoute('garage://open/vehicles/abc')).toBe('/vehicles/abc');
    expect(widgetRoute('https://example.com/log')).toBeNull();
  });
});

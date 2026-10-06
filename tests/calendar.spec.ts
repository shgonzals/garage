import { describe, expect, it } from 'vitest';
import { googleCalendarUrl } from '@/domain/calendar';

describe('Google Calendar', () => {
  it('enlace de evento de día completo, con el día siguiente como fin', () => {
    const url = new URL(googleCalendarUrl({ title: 'CBR600RR · Seguro', date: '2026-10-31', details: 'Vence el 31 oct' }));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('CBR600RR · Seguro');
    expect(url.searchParams.get('dates')).toBe('20261031/20261101');
    expect(url.searchParams.get('details')).toBe('Vence el 31 oct');
  });
});

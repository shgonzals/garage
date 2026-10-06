import { addDays, format, parseISO } from 'date-fns';
import type { IsoDate } from './types';

/**
 * Enlace "crear evento" de Google Calendar, ya relleno: evento de día completo.
 * No necesita permisos ni cuenta en la app; Google pide confirmar antes de guardarlo.
 */
export function googleCalendarUrl(event: { title: string; date: IsoDate; details: string }): string {
  const day = (iso: IsoDate) => format(parseISO(iso), 'yyyyMMdd');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    // Día completo: fin exclusivo, el día siguiente.
    dates: `${day(event.date)}/${day(format(addDays(parseISO(event.date), 1), 'yyyy-MM-dd'))}`,
    details: event.details,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

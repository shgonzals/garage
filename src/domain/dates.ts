import { format } from 'date-fns';
import type { IsoDate, IsoDateTime } from './types';

export function toIsoDate(date: Date): IsoDate {
  return format(date, 'yyyy-MM-dd');
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date());
}

export function nowIso(): IsoDateTime {
  return new Date().toISOString();
}

import type { Urgency } from '@/domain/reminders';

/** Clase CSS (danger/warning/success/neutral) por urgencia. */
export const STATUS_TONE: Record<Urgency, 'danger' | 'warning' | 'success' | 'neutral'> = {
  overdue: 'danger',
  soon: 'warning',
  ok: 'success',
  unknown: 'neutral',
};

export const STATUS_DOT: Record<Urgency, string> = {
  overdue: '🔴',
  soon: '🟠',
  ok: '🟢',
  unknown: '⚪',
};

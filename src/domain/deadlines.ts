import { addYears, parseISO, subDays } from 'date-fns';
import { toIsoDate } from './dates';
import type { BuiltinTaskId, IsoDate, Vehicle } from './types';

/**
 * Vencimientos anuales con fecha fija: seguro e impuesto de circulación.
 *
 * El usuario indica en el vehículo cuándo vence (la fecha de la póliza o del recibo) y renueva
 * apuntándolo en el registro rápido. La fecha siguiente se ancla a la anterior + 1 año, no al día
 * del pago: la póliza sigue venciendo el mismo día aunque se pague una semana antes.
 */
export const ANNUAL_DEADLINES: readonly { taskId: BuiltinTaskId; field: 'insurance_due' | 'road_tax_due' }[] = [
  { taskId: 'insurance', field: 'insurance_due' },
  { taskId: 'road_tax', field: 'road_tax_due' },
];

/** Una renovación cuenta para un vencimiento si se hace a partir de 90 días antes. */
export const RENEWAL_WINDOW_DAYS = 90;

/** "Pronto" para seguro e impuesto: un mes antes. */
export const DEADLINE_SOON_DAYS = 30;

export function isAnnualDeadline(taskId: string): boolean {
  return ANNUAL_DEADLINES.some((d) => d.taskId === taskId);
}

export function deadlineAnchor(vehicle: Vehicle, taskId: BuiltinTaskId): IsoDate | null {
  const d = ANNUAL_DEADLINES.find((x) => x.taskId === taskId);
  return d ? vehicle[d.field] : null;
}

/**
 * Próximo vencimiento: parte de la fecha indicada y suma un año por cada renovación registrada
 * dentro de su ventana. Sin fecha indicada pero con renovaciones, la última + 1 año.
 */
export function nextAnnualDue(anchor: IsoDate | null, renewals: readonly IsoDate[]): IsoDate | null {
  const sorted = [...renewals].sort();
  if (!anchor) {
    const last = sorted.at(-1);
    return last ? toIsoDate(addYears(parseISO(last), 1)) : null;
  }
  let due = anchor;
  for (const r of sorted) {
    if (r >= toIsoDate(subDays(parseISO(due), RENEWAL_WINDOW_DAYS))) due = toIsoDate(addYears(parseISO(due), 1));
  }
  return due;
}

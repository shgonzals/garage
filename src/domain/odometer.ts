import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { OdometerReading } from './types';

type Reading = Pick<OdometerReading, 'id' | 'km' | 'read_on'>;

/** Más que esto al día no lo hace nadie: es un dedo de más (23.100 → 231.000). */
export const MAX_KM_PER_DAY = 1500;

/**
 * Lecturas probablemente erróneas, por dos motivos:
 * - Superan a una lectura de una fecha posterior (los km no bajan).
 * - Saltan más de `MAX_KM_PER_DAY` por día respecto a la lectura anterior. Cubre el caso
 *   más común, que la lectura errónea sea justo la última y nada posterior la contradiga.
 */
export function suspiciousReadings(readings: readonly Reading[]): Set<string> {
  const out = new Set<string>();
  const byDateDesc = [...readings].sort((a, b) => b.read_on.localeCompare(a.read_on));

  let minLater = Infinity; // menor km visto en fechas estrictamente posteriores
  let i = 0;
  while (i < byDateDesc.length) {
    // Agrupa el mismo día: dos lecturas del mismo día no se contradicen entre sí.
    const day = byDateDesc[i]!.read_on;
    let minToday = Infinity;
    for (; i < byDateDesc.length && byDateDesc[i]!.read_on === day; i++) {
      const r = byDateDesc[i]!;
      if (r.km > minLater) out.add(r.id);
      minToday = Math.min(minToday, r.km);
    }
    minLater = Math.min(minLater, minToday);
  }

  for (const r of readings) {
    // Lectura anterior de referencia: la de más km entre las de igual o menor fecha y menos km.
    let prev: Reading | undefined;
    for (const o of readings) {
      if (o.id === r.id || o.read_on > r.read_on || o.km > r.km) continue;
      if (!prev || o.km > prev.km) prev = o;
    }
    if (!prev) continue;
    const days = Math.max(differenceInCalendarDays(parseISO(r.read_on), parseISO(prev.read_on)), 1);
    if ((r.km - prev.km) / days > MAX_KM_PER_DAY) out.add(r.id);
  }
  return out;
}

import type { EntryWithItems, Schedule, TaskId, Vehicle } from '@/domain/types';

const TS = '2026-01-01T00:00:00.000Z';

export function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    name: 'CBR600RR',
    type: 'motorcycle',
    make: 'Honda',
    model: 'CBR600RR',
    plate: null,
    first_registration: null,
    photo: null,
    created_at: TS,
    updated_at: TS,
    deleted_at: null,
    ...overrides,
  };
}

export function schedule(
  task_id: TaskId,
  interval_km: number | null,
  interval_days: number | null,
  overrides: Partial<Schedule> = {},
): Schedule {
  return { vehicle_id: 'v1', task_id, interval_km, interval_days, enabled: true, updated_at: TS, deleted_at: null, ...overrides };
}

let seq = 0;
export function entry(
  done_on: string,
  odometer_km: number | null,
  tasks: TaskId[],
  overrides: Partial<EntryWithItems> = {},
): EntryWithItems {
  const id = `e${++seq}`;
  return {
    id,
    vehicle_id: 'v1',
    done_on,
    odometer_km,
    cost_cents: null,
    currency: 'EUR',
    notes: null,
    created_at: TS,
    updated_at: TS,
    deleted_at: null,
    items: tasks.map((task_id, i) => ({
      id: `${id}-${i}`,
      entry_id: id,
      task_id,
      notes: null,
      created_at: TS,
      updated_at: TS,
      deleted_at: null,
    })),
    ...overrides,
  };
}

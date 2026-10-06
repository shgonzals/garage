import { describe, expect, it } from 'vitest';
import { getTask, suggestedInterval, TASKS, tasksForType, YEAR } from '@/domain/tasks';

describe('catálogo de tareas', () => {
  it('cada tarea tiene categoría y un id único', () => {
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    expect(TASKS.every((t) => t.category)).toBe(true);
  });

  it('las tareas de moto no aparecen en un coche', () => {
    const car = tasksForType('car').map((t) => t.id);
    expect(car).not.toContain('chain_lube');
    expect(car).not.toContain('fork_oil');
    expect(car).toContain('oil');
    expect(car).toContain('gear_oil');

    const moto = tasksForType('motorcycle').map((t) => t.id);
    expect(moto).toEqual(expect.arrayContaining(['chain_kit', 'fork_oil', 'steering_bearings', 'throttle_sync', 'clutch_fluid']));
  });

  it('intervalo al activar: el por defecto o, si no hay, el orientativo', () => {
    expect(suggestedInterval(getTask('oil'), 'motorcycle')).toEqual({ km: 6000, days: YEAR });
    expect(suggestedInterval(getTask('fork_oil'), 'motorcycle')).toEqual({ km: 20000, days: 2 * YEAR });
    expect(suggestedInterval(getTask('brake_pads'), 'car')).toBeNull();
  });

  it('las tareas nuevas no se programan solas al dar de alta un vehículo', () => {
    for (const id of ['fork_oil', 'chain_kit', 'drive_belt'] as const) {
      expect(getTask(id).defaults).toEqual({});
    }
  });
});

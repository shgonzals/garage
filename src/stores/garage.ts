import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type { GarageRepository } from '@/db/repository';
import { todayIso } from '@/domain/dates';
import { compareReminders, computeReminders, summarize, type Reminder, type VehicleSummary } from '@/domain/reminders';
import type { QuickLogData, ScheduleInput, VehicleData } from '@/domain/schemas';
import type { EntryWithItems, Schedule, TaskId, Vehicle } from '@/domain/types';

export const useGarageStore = defineStore('garage', () => {
  const repo = shallowRef<GarageRepository | null>(null);
  const ready = ref(false);

  const vehicles = ref<Vehicle[]>([]);
  const entries = ref<EntryWithItems[]>([]);
  const schedules = ref<Schedule[]>([]);
  const currentKm = ref(new Map<string, number>());
  const today = ref(todayIso());

  function r(): GarageRepository {
    if (!repo.value) throw new Error('Base de datos no inicializada');
    return repo.value;
  }

  async function init(repository: GarageRepository) {
    repo.value = repository;
    await reload();
    ready.value = true;
  }

  /** Volumen de datos personal (decenas de vehículos, cientos de entries): se carga todo en memoria. */
  async function reload() {
    const [v, e, s, km] = await Promise.all([
      r().listVehicles(),
      r().listEntries(),
      r().listSchedules(),
      r().currentKmByVehicle(),
    ]);
    vehicles.value = v;
    entries.value = e;
    schedules.value = s;
    currentKm.value = km;
    today.value = todayIso();
  }

  // ── Derivados ──────────────────────────────────────────────

  const vehicleById = computed(() => new Map(vehicles.value.map((v) => [v.id, v])));

  const entriesByVehicle = computed(() => {
    const map = new Map<string, EntryWithItems[]>();
    for (const e of entries.value) {
      const list = map.get(e.vehicle_id) ?? [];
      list.push(e);
      map.set(e.vehicle_id, list);
    }
    return map;
  });

  const remindersByVehicle = computed(() => {
    const map = new Map<string, Reminder[]>();
    for (const vehicle of vehicles.value) {
      map.set(
        vehicle.id,
        computeReminders({
          vehicle,
          currentKm: currentKm.value.get(vehicle.id) ?? null,
          schedules: schedules.value.filter((s) => s.vehicle_id === vehicle.id),
          entries: entriesByVehicle.value.get(vehicle.id) ?? [],
          today: today.value,
        }),
      );
    }
    return map;
  });

  const summaries = computed(() => {
    const map = new Map<string, VehicleSummary>();
    for (const [id, reminders] of remindersByVehicle.value) map.set(id, summarize(reminders));
    return map;
  });

  const allReminders = computed(() => [...remindersByVehicle.value.values()].flat().sort(compareReminders));

  /** Tareas que más urge registrar para un vehículo, para destacarlas en el registro rápido. */
  function suggestedTasks(vehicleId: string): TaskId[] {
    return (remindersByVehicle.value.get(vehicleId) ?? [])
      .filter((rem) => rem.status === 'overdue' || rem.status === 'soon')
      .map((rem) => rem.taskId);
  }

  // ── Acciones ───────────────────────────────────────────────

  async function createVehicle(data: VehicleData): Promise<Vehicle> {
    const vehicle = await r().createVehicle(data, todayIso());
    await reload();
    return vehicle;
  }

  async function updateVehicle(id: string, data: VehicleData) {
    await r().updateVehicle(id, data);
    if (data.initial_km !== null && data.initial_km !== currentKm.value.get(id)) {
      await r().addOdometerReading(id, data.initial_km, todayIso());
    }
    await reload();
  }

  async function deleteVehicle(id: string) {
    await r().deleteVehicle(id);
    await reload();
  }

  async function addReading(vehicleId: string, km: number) {
    await r().addOdometerReading(vehicleId, km, todayIso());
    await reload();
  }

  async function logEntry(data: QuickLogData): Promise<string> {
    const id = await r().createEntry(data);
    await reload();
    return id;
  }

  async function updateEntry(id: string, data: QuickLogData) {
    await r().updateEntry(id, data);
    await reload();
  }

  function listReadings(vehicleId: string) {
    return r().listReadings(vehicleId);
  }

  async function deleteReading(id: string) {
    await r().deleteReading(id);
    await reload();
  }

  async function deleteEntry(id: string) {
    await r().deleteEntry(id);
    await reload();
  }

  async function saveSchedules(vehicleId: string, changes: { taskId: TaskId; input: ScheduleInput }[]) {
    for (const c of changes) await r().upsertSchedule(vehicleId, c.taskId, c.input);
    await reload();
  }

  return {
    ready,
    vehicles,
    entries,
    schedules,
    currentKm,
    today,
    vehicleById,
    entriesByVehicle,
    remindersByVehicle,
    summaries,
    allReminders,
    repository: computed(() => repo.value),
    init,
    reload,
    suggestedTasks,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    addReading,
    logEntry,
    deleteEntry,
    updateEntry,
    listReadings,
    deleteReading,
    saveSchedules,
  };
});

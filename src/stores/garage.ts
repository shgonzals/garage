import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { MIGRATIONS } from '@/db/migrations';
import type { GarageRepository } from '@/db/repository';
import { backupFileName, parseBackup, type BackupTable } from '@/domain/backup';
import { todayIso } from '@/domain/dates';
import { compareReminders, computeReminders, summarize, type Reminder, type VehicleSummary } from '@/domain/reminders';
import type { CustomTaskInput, QuickLogData, ScheduleInput, VehicleData } from '@/domain/schemas';
import { registerCustomTasks, TASKS, tasksForType, type TaskDef } from '@/domain/tasks';
import { estimateKmRate, estimatedKmDueDate, type KmRate } from '@/domain/forecast';
import type { FuelData, FuelLog } from '@/domain/fuel';
import { applySnoozes, type Snooze, type SnoozeUntil } from '@/domain/snooze';
import { unitInfo } from '@/domain/units';
import type {
  CustomTask,
  CustomTaskId,
  EntryWithItems,
  IsoDate,
  OdometerReading,
  Schedule,
  TaskId,
  Vehicle,
} from '@/domain/types';

export const useGarageStore = defineStore('garage', () => {
  const repo = shallowRef<GarageRepository | null>(null);
  const ready = ref(false);

  const vehicles = ref<Vehicle[]>([]);
  const entries = ref<EntryWithItems[]>([]);
  const schedules = ref<Schedule[]>([]);
  const currentKm = ref(new Map<string, number>());
  const readings = ref<OdometerReading[]>([]);
  const customTasks = ref<CustomTask[]>([]);
  const snoozes = ref<Snooze[]>([]);
  const fuelLogs = ref<FuelLog[]>([]);
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
    const [v, e, s, km, rd, ct, sn, fl] = await Promise.all([
      r().listVehicles(),
      r().listEntries(),
      r().listSchedules(),
      r().currentKmByVehicle(),
      r().listAllReadings(),
      r().listCustomTasks(),
      r().listSnoozes(),
      r().listFuelLogs(),
    ]);
    // Antes que el resto: los derivados (recordatorios, etiquetas) resuelven nombres con getTask.
    registerCustomTasks(ct);
    customTasks.value = ct;
    snoozes.value = sn;
    fuelLogs.value = fl;
    vehicles.value = v;
    entries.value = e;
    schedules.value = s;
    currentKm.value = km;
    readings.value = rd;
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
      const km = currentKm.value.get(vehicle.id) ?? null;
      const reminders = computeReminders({
        vehicle,
        currentKm: km,
        schedules: schedules.value.filter((s) => s.vehicle_id === vehicle.id),
        entries: entriesByVehicle.value.get(vehicle.id) ?? [],
        today: today.value,
      });
      // Los aplazados pasan a `snoozed` y se reordenan (dejan de contar como vencidos).
      map.set(vehicle.id, applySnoozes(reminders, snoozes.value, km, today.value).sort(compareReminders));
    }
    return map;
  });

  const summaries = computed(() => {
    const map = new Map<string, VehicleSummary>();
    for (const [id, reminders] of remindersByVehicle.value) map.set(id, summarize(reminders));
    return map;
  });

  /** Tareas que se pueden registrar en un vehículo: catálogo de su tipo + sus personalizadas vigentes. */
  function tasksFor(vehicleId: string): TaskDef[] {
    const vehicle = vehicleById.value.get(vehicleId);
    const own: TaskDef[] = customTasks.value
      .filter((t) => t.vehicle_id === vehicleId && !t.deleted_at)
      .map((t) => ({ id: t.id, label: t.label, emoji: t.emoji, category: 'otros', defaults: {} }));
    return [...(vehicle ? tasksForType(vehicle.type) : TASKS), ...own];
  }

  /** Lecturas por vehículo (orden por fecha). */
  const readingsByVehicle = computed(() => {
    const map = new Map<string, OdometerReading[]>();
    for (const rd of readings.value) {
      const list = map.get(rd.vehicle_id) ?? [];
      list.push(rd);
      map.set(rd.vehicle_id, list);
    }
    return map;
  });

  /** Ritmo de uso (km/día) de cada vehículo; `null` si aún no hay datos suficientes. */
  const kmRates = computed(() => {
    const map = new Map<string, KmRate | null>();
    for (const v of vehicles.value) {
      map.set(v.id, estimateKmRate(readingsByVehicle.value.get(v.id) ?? [], unitInfo(v.type).maxPerDay));
    }
    return map;
  });

  /** Fecha estimada a tu ritmo para un recordatorio por km, si llega antes que su fecha límite. */
  function kmEstimate(rem: Reminder): IsoDate | null {
    return estimatedKmDueDate(rem, kmRates.value.get(rem.vehicleId) ?? null, today.value);
  }

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

  async function logFuel(data: FuelData): Promise<string> {
    const id = await r().createFuel(data);
    await reload();
    return id;
  }

  async function updateFuel(id: string, data: FuelData) {
    await r().updateFuel(id, data);
    await reload();
  }

  async function deleteFuel(id: string) {
    await r().deleteFuel(id);
    await reload();
  }

  async function snooze(vehicleId: string, taskId: TaskId, until: SnoozeUntil) {
    await r().snooze(vehicleId, taskId, until);
    await reload();
  }

  async function unsnooze(vehicleId: string, taskId: TaskId) {
    await r().unsnooze(vehicleId, taskId);
    await reload();
  }

  async function createCustomTask(vehicleId: string, input: CustomTaskInput): Promise<CustomTask> {
    const task = await r().createCustomTask(vehicleId, input);
    await reload();
    return task;
  }

  async function renameCustomTask(id: CustomTaskId, label: string, emoji: string) {
    await r().renameCustomTask(id, label, emoji);
    await reload();
  }

  async function deleteCustomTask(id: CustomTaskId) {
    await r().deleteCustomTask(id);
    await reload();
  }

  /** Copia de seguridad: nombre de archivo y contenido JSON. */
  async function exportBackup(): Promise<{ name: string; json: string }> {
    const backup = await r().exportBackup(MIGRATIONS.at(-1)!.version);
    return { name: backupFileName(todayIso()), json: JSON.stringify(backup) };
  }

  /** Valida e importa (fusionando) el texto de un archivo de copia. */
  async function importBackup(
    json: string,
  ): Promise<{ ok: true; counts: Record<BackupTable, number>; exportedAt: string } | { ok: false; error: string }> {
    const parsed = parseBackup(json, MIGRATIONS.at(-1)!.version);
    if (!parsed.ok) return parsed;
    const counts = await r().importBackup(parsed.backup);
    await reload();
    return { ok: true, counts, exportedAt: parsed.backup.exported_at };
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
    readingsByVehicle,
    customTasks,
    tasksFor,
    kmRates,
    kmEstimate,
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
    fuelLogs,
    logFuel,
    updateFuel,
    deleteFuel,
    snooze,
    unsnooze,
    createCustomTask,
    renameCustomTask,
    deleteCustomTask,
    exportBackup,
    importBackup,
  };
});

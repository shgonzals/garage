import { v7 as uuidv7 } from 'uuid';
import { BACKUP_FORMAT, BACKUP_TABLES, backupColumns, type Backup, type BackupTable } from '@/domain/backup';
import { nowIso } from '@/domain/dates';
import { litersToCentiliters, type FuelData, type FuelLog } from '@/domain/fuel';
import type { Snooze, SnoozeUntil } from '@/domain/snooze';
import { eurosToCents, type CustomTaskInput, type QuickLogData, type ScheduleInput, type VehicleData } from '@/domain/schemas';
import { defaultSchedulesFor } from '@/domain/tasks';
import type {
  CustomTask,
  CustomTaskId,
  EntryItem,
  EntryWithItems,
  IsoDate,
  OdometerReading,
  Schedule,
  TaskId,
  Vehicle,
} from '@/domain/types';
import type { SqlDatabase, SqlStatement, SqlValue } from './sql';

type ScheduleRow = Omit<Schedule, 'enabled'> & { enabled: number };

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

function insert(table: string, row: Record<string, SqlValue>): SqlStatement {
  const cols = Object.keys(row);
  return {
    sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders(cols.length)})`,
    params: Object.values(row),
  };
}

/** Acceso a datos local. Todas las lecturas excluyen filas con borrado lógico. */
export class GarageRepository {
  constructor(
    private readonly db: SqlDatabase,
    private readonly now: () => string = nowIso,
    private readonly newId: () => string = uuidv7,
  ) {}

  // ── Vehículos ──────────────────────────────────────────────

  listVehicles(): Promise<Vehicle[]> {
    return this.db.query<Vehicle>('SELECT * FROM vehicles WHERE deleted_at IS NULL ORDER BY created_at');
  }

  async getVehicle(id: string): Promise<Vehicle | null> {
    const rows = await this.db.query<Vehicle>('SELECT * FROM vehicles WHERE id = ? AND deleted_at IS NULL', [id]);
    return rows[0] ?? null;
  }

  /** Alta de vehículo + plan de mantenimiento por defecto + lectura inicial de km. */
  async createVehicle(data: VehicleData, today: IsoDate): Promise<Vehicle> {
    const ts = this.now();
    const vehicle: Vehicle = {
      id: this.newId(),
      name: data.name,
      type: data.type,
      make: data.make,
      model: data.model,
      plate: data.plate,
      first_registration: data.first_registration,
      insurance_due: data.insurance_due,
      road_tax_due: data.road_tax_due,
      photo: data.photo,
      created_at: ts,
      updated_at: ts,
      deleted_at: null,
    };
    const statements: SqlStatement[] = [insert('vehicles', { ...vehicle })];

    for (const { taskId, interval } of defaultSchedulesFor(data.type)) {
      statements.push(
        insert('schedules', {
          vehicle_id: vehicle.id,
          task_id: taskId,
          interval_km: interval.km,
          interval_days: interval.days,
          enabled: 1,
          updated_at: ts,
          deleted_at: null,
        }),
      );
    }
    if (data.initial_km !== null) {
      statements.push(this.readingInsert(vehicle.id, data.initial_km, today, 'manual', ts));
    }
    await this.db.batch(statements);
    return vehicle;
  }

  async updateVehicle(id: string, data: VehicleData): Promise<void> {
    await this.db.run(
      `UPDATE vehicles SET name = ?, type = ?, make = ?, model = ?, plate = ?, first_registration = ?,
         insurance_due = ?, road_tax_due = ?, photo = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [
        data.name,
        data.type,
        data.make,
        data.model,
        data.plate,
        data.first_registration,
        data.insurance_due,
        data.road_tax_due,
        data.photo,
        this.now(),
        id,
      ],
    );
  }

  async deleteVehicle(id: string): Promise<void> {
    const ts = this.now();
    await this.db.run('UPDATE vehicles SET deleted_at = ?, updated_at = ? WHERE id = ?', [ts, ts, id]);
  }

  // ── Odómetro ───────────────────────────────────────────────

  private readingInsert(
    vehicleId: string,
    km: number,
    readOn: IsoDate,
    source: OdometerReading['source'],
    ts: string,
    entryId: string | null = null,
    fuelId: string | null = null,
  ): SqlStatement {
    return insert('odometer_readings', {
      id: this.newId(),
      vehicle_id: vehicleId,
      km,
      read_on: readOn,
      source,
      entry_id: entryId,
      fuel_id: fuelId,
      created_at: ts,
      updated_at: ts,
      deleted_at: null,
    });
  }

  async addOdometerReading(vehicleId: string, km: number, readOn: IsoDate): Promise<void> {
    const s = this.readingInsert(vehicleId, km, readOn, 'manual', this.now());
    await this.db.run(s.sql, s.params);
  }

  /** Todas las lecturas vigentes: base del ritmo de km de cada vehículo. */
  listAllReadings(): Promise<OdometerReading[]> {
    return this.db.query<OdometerReading>(
      'SELECT * FROM odometer_readings WHERE deleted_at IS NULL ORDER BY vehicle_id, read_on, km',
    );
  }

  /** Lecturas de un vehículo, la más reciente primero. */
  listReadings(vehicleId: string): Promise<OdometerReading[]> {
    return this.db.query<OdometerReading>(
      `SELECT * FROM odometer_readings WHERE vehicle_id = ? AND deleted_at IS NULL
       ORDER BY read_on DESC, km DESC, created_at DESC`,
      [vehicleId],
    );
  }

  /** Borra una lectura manual. Las de un registro o repostaje se corrigen editándolos o borrándolos. */
  async deleteReading(id: string): Promise<void> {
    const ts = this.now();
    await this.db.run(
      'UPDATE odometer_readings SET deleted_at = ?, updated_at = ? WHERE id = ? AND entry_id IS NULL AND fuel_id IS NULL',
      [ts, ts, id],
    );
  }

  /** Km actuales por vehículo = lectura máxima registrada. */
  async currentKmByVehicle(): Promise<Map<string, number>> {
    const rows = await this.db.query<{ vehicle_id: string; km: number }>(
      `SELECT vehicle_id, MAX(km) AS km FROM odometer_readings WHERE deleted_at IS NULL GROUP BY vehicle_id`,
    );
    return new Map(rows.map((r) => [r.vehicle_id, r.km]));
  }

  // ── Entries (registros de mantenimiento) ───────────────────

  async listEntries(vehicleId?: string): Promise<EntryWithItems[]> {
    const where = vehicleId ? 'AND vehicle_id = ?' : '';
    const entries = await this.db.query<Omit<EntryWithItems, 'items'>>(
      `SELECT * FROM entries WHERE deleted_at IS NULL ${where} ORDER BY done_on DESC, odometer_km DESC, created_at DESC`,
      vehicleId ? [vehicleId] : [],
    );
    if (entries.length === 0) return [];

    const items = await this.db.query<EntryItem>(
      `SELECT ei.* FROM entry_items ei JOIN entries e ON e.id = ei.entry_id
       WHERE ei.deleted_at IS NULL AND e.deleted_at IS NULL ${vehicleId ? 'AND e.vehicle_id = ?' : ''}
       ORDER BY ei.created_at`,
      vehicleId ? [vehicleId] : [],
    );
    const byEntry = new Map<string, EntryItem[]>();
    for (const item of items) {
      const list = byEntry.get(item.entry_id) ?? [];
      list.push(item);
      byEntry.set(item.entry_id, list);
    }
    return entries.map((e) => ({ ...e, items: byEntry.get(e.id) ?? [] }));
  }

  private itemInserts(entryId: string, taskIds: TaskId[], ts: string): SqlStatement[] {
    return taskIds.map((taskId) =>
      insert('entry_items', {
        id: this.newId(),
        entry_id: entryId,
        task_id: taskId,
        notes: null,
        created_at: ts,
        updated_at: ts,
        deleted_at: null,
      }),
    );
  }

  private softDeleteEntryChildren(entryId: string, ts: string): SqlStatement[] {
    return [
      {
        sql: 'UPDATE entry_items SET deleted_at = ?, updated_at = ? WHERE entry_id = ? AND deleted_at IS NULL',
        params: [ts, ts, entryId],
      },
      {
        sql: 'UPDATE odometer_readings SET deleted_at = ?, updated_at = ? WHERE entry_id = ? AND deleted_at IS NULL',
        params: [ts, ts, entryId],
      },
    ];
  }

  /** Registro rápido: entry + tareas + lectura de km, en una transacción. */
  async createEntry(data: QuickLogData): Promise<string> {
    const ts = this.now();
    const entryId = this.newId();
    const statements: SqlStatement[] = [
      insert('entries', {
        id: entryId,
        vehicle_id: data.vehicle_id,
        done_on: data.done_on,
        odometer_km: data.odometer_km,
        cost_cents: data.cost !== null ? eurosToCents(data.cost) : null,
        currency: 'EUR',
        notes: data.notes,
        created_at: ts,
        updated_at: ts,
        deleted_at: null,
      }),
      ...this.itemInserts(entryId, data.task_ids, ts),
    ];
    if (data.odometer_km !== null) {
      statements.push(this.readingInsert(data.vehicle_id, data.odometer_km, data.done_on, 'entry', ts, entryId));
    }
    await this.db.batch(statements);
    return entryId;
  }

  /** Corrige un registro: reemplaza sus tareas y su lectura de km, en una transacción. */
  async updateEntry(id: string, data: QuickLogData): Promise<void> {
    const ts = this.now();
    const statements: SqlStatement[] = [
      {
        sql: `UPDATE entries SET vehicle_id = ?, done_on = ?, odometer_km = ?, cost_cents = ?, notes = ?, updated_at = ?
              WHERE id = ? AND deleted_at IS NULL`,
        params: [
          data.vehicle_id,
          data.done_on,
          data.odometer_km,
          data.cost !== null ? eurosToCents(data.cost) : null,
          data.notes,
          ts,
          id,
        ],
      },
      ...this.softDeleteEntryChildren(id, ts),
      ...this.itemInserts(id, data.task_ids, ts),
    ];
    if (data.odometer_km !== null) {
      statements.push(this.readingInsert(data.vehicle_id, data.odometer_km, data.done_on, 'entry', ts, id));
    }
    await this.db.batch(statements);
  }

  /** Borra el registro, sus tareas y la lectura de km que generó. */
  async deleteEntry(id: string): Promise<void> {
    const ts = this.now();
    await this.db.batch([
      { sql: 'UPDATE entries SET deleted_at = ?, updated_at = ? WHERE id = ?', params: [ts, ts, id] },
      ...this.softDeleteEntryChildren(id, ts),
    ]);
  }

  // ── Plan de mantenimiento ──────────────────────────────────

  async listSchedules(vehicleId?: string): Promise<Schedule[]> {
    const rows = await this.db.query<ScheduleRow>(
      `SELECT * FROM schedules WHERE deleted_at IS NULL ${vehicleId ? 'AND vehicle_id = ?' : ''}`,
      vehicleId ? [vehicleId] : [],
    );
    return rows.map((r) => ({ ...r, enabled: r.enabled === 1 }));
  }

  async upsertSchedule(vehicleId: string, taskId: TaskId, input: ScheduleInput): Promise<void> {
    const s = this.scheduleUpsert(vehicleId, taskId, input, this.now());
    await this.db.run(s.sql, s.params);
  }

  private scheduleUpsert(vehicleId: string, taskId: TaskId, input: ScheduleInput, ts: string): SqlStatement {
    return {
      sql: `INSERT INTO schedules (vehicle_id, task_id, interval_km, interval_days, enabled, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT (vehicle_id, task_id) DO UPDATE SET
         interval_km = excluded.interval_km,
         interval_days = excluded.interval_days,
         enabled = excluded.enabled,
         updated_at = excluded.updated_at,
         deleted_at = NULL`,
      params: [vehicleId, taskId, input.interval_km, input.interval_days, input.enabled ? 1 : 0, ts],
    };
  }

  // ── Repostajes ─────────────────────────────────────────────

  listFuelLogs(): Promise<FuelLog[]> {
    return this.db.query<FuelLog>('SELECT * FROM fuel_logs WHERE deleted_at IS NULL ORDER BY filled_on DESC, odometer_km DESC');
  }

  private fuelRow(data: FuelData) {
    return {
      vehicle_id: data.vehicle_id,
      filled_on: data.filled_on,
      odometer_km: data.odometer_km,
      centiliters: litersToCentiliters(data.liters),
      cost_cents: data.cost !== null ? eurosToCents(data.cost) : null,
      currency: 'EUR',
      full_tank: data.full_tank ? 1 : 0,
      notes: data.notes,
    };
  }

  private softDeleteFuelReadings(fuelId: string, ts: string): SqlStatement {
    return {
      sql: 'UPDATE odometer_readings SET deleted_at = ?, updated_at = ? WHERE fuel_id = ? AND deleted_at IS NULL',
      params: [ts, ts, fuelId],
    };
  }

  /** Repostaje + su lectura de km, en una transacción. */
  async createFuel(data: FuelData): Promise<string> {
    const ts = this.now();
    const id = this.newId();
    const statements: SqlStatement[] = [
      insert('fuel_logs', { id, ...this.fuelRow(data), created_at: ts, updated_at: ts, deleted_at: null }),
    ];
    if (data.odometer_km !== null) {
      statements.push(this.readingInsert(data.vehicle_id, data.odometer_km, data.filled_on, 'manual', ts, null, id));
    }
    await this.db.batch(statements);
    return id;
  }

  async updateFuel(id: string, data: FuelData): Promise<void> {
    const ts = this.now();
    const row = this.fuelRow(data);
    const cols = Object.keys(row);
    const statements: SqlStatement[] = [
      {
        sql: `UPDATE fuel_logs SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
        params: [...(Object.values(row) as SqlValue[]), ts, id],
      },
      this.softDeleteFuelReadings(id, ts),
    ];
    if (data.odometer_km !== null) {
      statements.push(this.readingInsert(data.vehicle_id, data.odometer_km, data.filled_on, 'manual', ts, null, id));
    }
    await this.db.batch(statements);
  }

  async deleteFuel(id: string): Promise<void> {
    const ts = this.now();
    await this.db.batch([
      { sql: 'UPDATE fuel_logs SET deleted_at = ?, updated_at = ? WHERE id = ?', params: [ts, ts, id] },
      this.softDeleteFuelReadings(id, ts),
    ]);
  }

  // ── Aplazamientos ──────────────────────────────────────────

  listSnoozes(): Promise<Snooze[]> {
    return this.db.query<Snooze>('SELECT * FROM snoozes WHERE deleted_at IS NULL');
  }

  /** Aplaza (o cambia el aplazamiento de) un recordatorio. `created_at` marca desde cuándo cuenta. */
  async snooze(vehicleId: string, taskId: TaskId, until: SnoozeUntil): Promise<void> {
    const ts = this.now();
    await this.db.run(
      `INSERT INTO snoozes (vehicle_id, task_id, until_date, until_km, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT (vehicle_id, task_id) DO UPDATE SET
         until_date = excluded.until_date,
         until_km = excluded.until_km,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         deleted_at = NULL`,
      [vehicleId, taskId, until.date, until.km, ts, ts],
    );
  }

  async unsnooze(vehicleId: string, taskId: TaskId): Promise<void> {
    const ts = this.now();
    await this.db.run(
      'UPDATE snoozes SET deleted_at = ?, updated_at = ? WHERE vehicle_id = ? AND task_id = ? AND deleted_at IS NULL',
      [ts, ts, vehicleId, taskId],
    );
  }

  // ── Tareas personalizadas ──────────────────────────────────

  /** Todas, borradas incluidas: el historial necesita sus nombres. */
  listCustomTasks(): Promise<CustomTask[]> {
    return this.db.query<CustomTask>('SELECT * FROM custom_tasks ORDER BY created_at');
  }

  /** Alta de la tarea y de su intervalo en el plan del vehículo, en una transacción. */
  async createCustomTask(vehicleId: string, input: CustomTaskInput): Promise<CustomTask> {
    const ts = this.now();
    const task: CustomTask = {
      id: `custom:${this.newId()}`,
      vehicle_id: vehicleId,
      label: input.label,
      emoji: input.emoji,
      created_at: ts,
      updated_at: ts,
      deleted_at: null,
    };
    await this.db.batch([
      insert('custom_tasks', { ...task }),
      this.scheduleUpsert(
        vehicleId,
        task.id,
        { interval_km: input.interval_km, interval_days: input.interval_days, enabled: true },
        ts,
      ),
    ]);
    return task;
  }

  async renameCustomTask(id: CustomTaskId, label: string, emoji: string): Promise<void> {
    await this.db.run('UPDATE custom_tasks SET label = ?, emoji = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [
      label,
      emoji,
      this.now(),
      id,
    ]);
  }

  /** La quita del plan; los registros donde aparece se conservan con su nombre. */
  async deleteCustomTask(id: CustomTaskId): Promise<void> {
    const ts = this.now();
    await this.db.batch([
      { sql: 'UPDATE custom_tasks SET deleted_at = ?, updated_at = ? WHERE id = ?', params: [ts, ts, id] },
      { sql: 'UPDATE schedules SET deleted_at = ?, updated_at = ? WHERE task_id = ?', params: [ts, ts, id] },
    ]);
  }

  // ── Copia de seguridad ─────────────────────────────────────

  /** Todas las filas de todas las tablas, borradas incluidas (las necesita la futura sync). */
  async exportBackup(schemaVersion: number): Promise<Backup> {
    const data = {} as Record<BackupTable, unknown[]>;
    for (const table of Object.keys(BACKUP_TABLES) as BackupTable[]) {
      const cols = backupColumns(table).join(', ');
      data[table] = await this.db.query(`SELECT ${cols} FROM ${table}`);
    }
    return {
      app: 'garage',
      format: BACKUP_FORMAT,
      schema_version: schemaVersion,
      exported_at: this.now(),
      data: data as Backup['data'],
    };
  }

  /**
   * Fusiona una copia con lo que hay: cada fila se identifica por su clave y gana la de
   * `updated_at` más reciente. Importar dos veces la misma copia no cambia nada. Todo o nada.
   */
  async importBackup(backup: Backup): Promise<Record<BackupTable, number>> {
    const statements: SqlStatement[] = [];
    const counts = {} as Record<BackupTable, number>;
    for (const table of Object.keys(BACKUP_TABLES) as BackupTable[]) {
      const cols = backupColumns(table);
      const key = BACKUP_TABLES[table].key as readonly string[];
      const updates = cols.filter((c) => !key.includes(c)).map((c) => `${c} = excluded.${c}`);
      const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders(cols.length)})
        ON CONFLICT (${key.join(', ')}) DO UPDATE SET ${updates.join(', ')}
        WHERE excluded.updated_at > ${table}.updated_at`;
      const rows = backup.data[table] as Record<string, SqlValue>[];
      for (const r of rows) statements.push({ sql, params: cols.map((c) => r[c] ?? null) });
      counts[table] = rows.length;
    }
    await this.db.batch(statements);
    return counts;
  }
}

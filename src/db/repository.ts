import { v7 as uuidv7 } from 'uuid';
import { BACKUP_FORMAT, BACKUP_TABLES, backupColumns, type Backup, type BackupTable } from '@/domain/backup';
import { nowIso } from '@/domain/dates';
import { eurosToCents, type QuickLogData, type ScheduleInput, type VehicleData } from '@/domain/schemas';
import { defaultSchedulesFor } from '@/domain/tasks';
import type {
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
      `UPDATE vehicles SET name = ?, type = ?, make = ?, model = ?, plate = ?, first_registration = ?, photo = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [data.name, data.type, data.make, data.model, data.plate, data.first_registration, data.photo, this.now(), id],
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
  ): SqlStatement {
    return insert('odometer_readings', {
      id: this.newId(),
      vehicle_id: vehicleId,
      km,
      read_on: readOn,
      source,
      entry_id: entryId,
      created_at: ts,
      updated_at: ts,
      deleted_at: null,
    });
  }

  async addOdometerReading(vehicleId: string, km: number, readOn: IsoDate): Promise<void> {
    const s = this.readingInsert(vehicleId, km, readOn, 'manual', this.now());
    await this.db.run(s.sql, s.params);
  }

  /** Lecturas de un vehículo, la más reciente primero. */
  listReadings(vehicleId: string): Promise<OdometerReading[]> {
    return this.db.query<OdometerReading>(
      `SELECT * FROM odometer_readings WHERE vehicle_id = ? AND deleted_at IS NULL
       ORDER BY read_on DESC, km DESC, created_at DESC`,
      [vehicleId],
    );
  }

  /** Borra una lectura manual. Las de un registro se corrigen editando o borrando el registro. */
  async deleteReading(id: string): Promise<void> {
    const ts = this.now();
    await this.db.run(
      'UPDATE odometer_readings SET deleted_at = ?, updated_at = ? WHERE id = ? AND entry_id IS NULL',
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
    await this.db.run(
      `INSERT INTO schedules (vehicle_id, task_id, interval_km, interval_days, enabled, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT (vehicle_id, task_id) DO UPDATE SET
         interval_km = excluded.interval_km,
         interval_days = excluded.interval_days,
         enabled = excluded.enabled,
         updated_at = excluded.updated_at,
         deleted_at = NULL`,
      [vehicleId, taskId, input.interval_km, input.interval_days, input.enabled ? 1 : 0, this.now()],
    );
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

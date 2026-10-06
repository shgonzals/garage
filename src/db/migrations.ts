import type { SqlDatabase } from './sql';

/**
 * Migraciones en orden. Nunca editar una ya publicada: añadir una nueva.
 *
 * Convenciones (ADRs):
 * - `id` UUID v7 generado en cliente.
 * - Borrado lógico con `deleted_at`, nunca DELETE.
 * - Dinero en céntimos (INTEGER) + `currency`.
 * - Fechas de calendario `YYYY-MM-DD`; instantes ISO 8601 UTC.
 */
export const MIGRATIONS: readonly { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE vehicles (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('motorcycle', 'moped', 'car', 'van')),
        make TEXT,
        model TEXT,
        plate TEXT,
        first_registration TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE odometer_readings (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
        km INTEGER NOT NULL CHECK (km >= 0),
        read_on TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'entry')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX idx_odometer_vehicle ON odometer_readings (vehicle_id, read_on);

      CREATE TABLE entries (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
        done_on TEXT NOT NULL,
        odometer_km INTEGER CHECK (odometer_km >= 0),
        cost_cents INTEGER CHECK (cost_cents >= 0),
        currency TEXT NOT NULL DEFAULT 'EUR',
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX idx_entries_vehicle ON entries (vehicle_id, done_on);

      CREATE TABLE entry_items (
        id TEXT PRIMARY KEY NOT NULL,
        entry_id TEXT NOT NULL REFERENCES entries(id),
        task_id TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX idx_entry_items_entry ON entry_items (entry_id);

      CREATE TABLE schedules (
        vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
        task_id TEXT NOT NULL,
        interval_km INTEGER CHECK (interval_km > 0),
        interval_days INTEGER CHECK (interval_days > 0),
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (vehicle_id, task_id)
      );

      -- Adjuntos (ITV, facturas…). Se usa a partir de la fase 0.2.
      CREATE TABLE documents (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
        entry_id TEXT REFERENCES entries(id),
        kind TEXT NOT NULL,
        title TEXT,
        uri TEXT NOT NULL,
        mime_type TEXT,
        expires_on TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX idx_documents_vehicle ON documents (vehicle_id);
    `,
  },
  {
    version: 2,
    sql: `
      -- Foto de perfil del vehículo (data URL, ~30-50 KB).
      ALTER TABLE vehicles ADD COLUMN photo TEXT;
    `,
  },
  {
    version: 3,
    sql: `
      -- Enlace lectura → registro, para que editar o borrar un registro corrija también los km.
      ALTER TABLE odometer_readings ADD COLUMN entry_id TEXT REFERENCES entries(id);
      CREATE INDEX idx_odometer_entry ON odometer_readings (entry_id);
      -- Datos previos: createEntry insertaba registro y lectura en el mismo batch, con el mismo created_at.
      UPDATE odometer_readings SET entry_id = (
        SELECT e.id FROM entries e
        WHERE e.vehicle_id = odometer_readings.vehicle_id
          AND e.created_at = odometer_readings.created_at
          AND e.odometer_km = odometer_readings.km
        LIMIT 1
      ) WHERE source = 'entry';
    `,
  },
  {
    version: 4,
    sql: `
      -- Tareas personalizadas por vehículo. Su intervalo vive en schedules (task_id = id).
      CREATE TABLE custom_tasks (
        id TEXT PRIMARY KEY NOT NULL,
        vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
        label TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX idx_custom_tasks_vehicle ON custom_tasks (vehicle_id);
    `,
  },
  {
    version: 5,
    sql: `
      -- Vencimientos anuales: seguro e impuesto de circulación.
      ALTER TABLE vehicles ADD COLUMN insurance_due TEXT;
      ALTER TABLE vehicles ADD COLUMN road_tax_due TEXT;
    `,
  },
];

export async function migrate(db: SqlDatabase): Promise<number> {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);',
  );
  const rows = await db.query<{ version: number | null }>('SELECT MAX(version) AS version FROM schema_migrations');
  const current = rows[0]?.version ?? 0;

  for (const m of MIGRATIONS.filter((m) => m.version > current)) {
    const statements = m.sql
      .split(';')
      .map((s) => s.replace(/--.*$/gm, '').trim())
      .filter(Boolean)
      .map((sql) => ({ sql }));
    await db.batch([
      ...statements,
      {
        sql: 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        params: [m.version, new Date().toISOString()],
      },
    ]);
  }
  return MIGRATIONS.at(-1)?.version ?? 0;
}

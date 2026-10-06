import initSqlJs from 'sql.js';
import type { SqlDatabase, SqlValue } from '@/db/sql';

/** SqlDatabase sobre sql.js en memoria: el mismo SQLite que usa jeep-sqlite en web. */
export async function openMemoryDatabase(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON;');

  const query = async <T>(sql: string, params: SqlValue[] = []): Promise<T[]> => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  };

  return {
    async exec(sql) {
      db.exec(sql);
    },
    query,
    async run(sql, params = []) {
      db.run(sql, params);
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        for (const s of statements) db.run(s.sql, s.params ?? []);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

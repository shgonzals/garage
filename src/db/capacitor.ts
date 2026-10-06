import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import type { SqlDatabase } from './sql';

/**
 * Abre la base de datos con @capacitor-community/sqlite.
 * En web usa el componente <jeep-sqlite> (sql.js + IndexedDB): requiere
 * `public/assets/sql-wasm.wasm`, que copia `scripts/copy-sql-wasm.mjs` en el postinstall.
 */
export async function openCapacitorDatabase(name = 'garage'): Promise<SqlDatabase> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const isWeb = Capacitor.getPlatform() === 'web';

  if (isWeb) {
    const { defineCustomElements } = await import('jeep-sqlite/loader');
    defineCustomElements(window);
    if (!document.querySelector('jeep-sqlite')) {
      document.body.appendChild(document.createElement('jeep-sqlite'));
    }
    await customElements.whenDefined('jeep-sqlite');
    await sqlite.initWebStore();
  }

  const consistent = (await sqlite.checkConnectionsConsistency()).result;
  const exists = (await sqlite.isConnection(name, false)).result;
  const conn =
    consistent && exists
      ? await sqlite.retrieveConnection(name, false)
      : await sqlite.createConnection(name, false, 'no-encryption', 1, false);
  await conn.open();
  await conn.execute('PRAGMA foreign_keys = ON;', false);

  // En web la BD vive en memoria: hay que volcarla a IndexedDB tras cada escritura.
  const persist = isWeb ? () => sqlite.saveToStore(name) : async () => {};

  return {
    async exec(sql) {
      await conn.execute(sql, true);
      await persist();
    },
    async query<T>(sql: string, params: unknown[] = []) {
      return ((await conn.query(sql, params)).values ?? []) as T[];
    },
    async run(sql, params = []) {
      await conn.run(sql, params, false);
      await persist();
    },
    async batch(statements) {
      if (statements.length === 0) return;
      await conn.executeSet(
        statements.map((s) => ({ statement: s.sql, values: s.params ?? [] })),
        true,
      );
      await persist();
    },
  };
}

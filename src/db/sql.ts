export type SqlValue = string | number | null;

export interface SqlStatement {
  sql: string;
  params?: SqlValue[];
}

/**
 * Mínimo común entre SQLite nativo (Capacitor), jeep-sqlite (web) y sql.js (tests).
 * El repositorio solo depende de esto, así se puede probar contra SQLite real en Vitest.
 */
export interface SqlDatabase {
  /** Ejecuta uno o varios statements sin parámetros (DDL). */
  exec(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  /** Ejecuta todos los statements en una única transacción. */
  batch(statements: SqlStatement[]): Promise<void>;
}

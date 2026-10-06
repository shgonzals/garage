// jeep-sqlite (SQLite en web) necesita sql-wasm.wasm servido desde /assets.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'node_modules/sql.js/dist/sql-wasm.wasm');
const destDir = resolve(root, 'public/assets');

if (!existsSync(src)) {
  console.warn('[copy-sql-wasm] sql.js no instalado todavía, se omite.');
  process.exit(0);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, resolve(destDir, 'sql-wasm.wasm'));
console.log('[copy-sql-wasm] public/assets/sql-wasm.wasm listo');

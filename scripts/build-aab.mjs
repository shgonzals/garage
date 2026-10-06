/**
 * Genera el paquete para Google Play de la versión actual: compila la web, la sincroniza con
 * Android y crea un AAB firmado con la clave de subida (android/keystore.properties).
 * Deja el resultado en releases/garage-<versión>.aab, listo para subirlo a Play Console.
 *
 * Uso: npm run aab
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));
const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';

if (!existsSync(`${root}android/keystore.properties`)) {
  console.error('Falta android/keystore.properties (la clave de firma). Ver store/PUBLICAR.md.');
  process.exit(1);
}

function run(cmd, cwd = root) {
  console.log(`\n› ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

run('npm run build');
run('npx cap sync android');
run(`${gradlew} bundleRelease`, `${root}android`);

mkdirSync(`${root}releases`, { recursive: true });
const out = `releases/garage-${version}.aab`;
copyFileSync(`${root}android/app/build/outputs/bundle/release/app-release.aab`, `${root}${out}`);
const mb = (statSync(`${root}${out}`).size / 1024 / 1024).toFixed(1);
console.log(`\n✓ AAB ${version} listo para Google Play: ${out} (${mb} MB)`);

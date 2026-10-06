/**
 * Genera el APK de la versión actual: compila la web, la sincroniza con Android, compila con
 * Gradle y deja el resultado en releases/garage-<versión>-debug.apk.
 *
 * Uso: npm run apk
 *
 * Es un APK de depuración: sirve para instalarlo en tu móvil o pasárselo a quien quiera probar
 * la app ("instalar apps desconocidas"). Para Google Play hace falta uno de publicación firmado.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));
// Ruta explícita: algunos Windows no buscan ejecutables en la carpeta actual (NoDefaultCurrentDirectoryInExePath).
const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';

function run(cmd, cwd = root) {
  console.log(`\n› ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

run('npm run build');
run('npx cap sync android');
run(`${gradlew} assembleDebug`, `${root}android`);

mkdirSync(`${root}releases`, { recursive: true });
const out = `releases/garage-${version}-debug.apk`;
copyFileSync(`${root}android/app/build/outputs/apk/debug/app-debug.apk`, `${root}${out}`);
const mb = (statSync(`${root}${out}`).size / 1024 / 1024).toFixed(1);
console.log(`\n✓ APK ${version} listo: ${out} (${mb} MB)`);

import { beforeEach, describe, expect, it } from 'vitest';
import { seedDemoData } from '@/db/demo';
import { MIGRATIONS, migrate } from '@/db/migrations';
import { GarageRepository } from '@/db/repository';
import { parseBackup } from '@/domain/backup';
import { openMemoryDatabase } from './helpers/sqljs';

const SCHEMA = MIGRATIONS.at(-1)!.version;

async function freshRepo(now = () => '2026-10-06T10:00:00.000Z') {
  const db = await openMemoryDatabase();
  await migrate(db);
  return new GarageRepository(db, now);
}

let source: GarageRepository;

beforeEach(async () => {
  source = await freshRepo();
  await seedDemoData(source, new Date('2026-10-06T12:00:00Z'));
});

/** Exporta, pasa por JSON (como el archivo real) y valida. */
async function roundTrip(repo: GarageRepository) {
  const json = JSON.stringify(await repo.exportBackup(SCHEMA));
  const parsed = parseBackup(json, SCHEMA);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.backup;
}

describe('copia de seguridad', () => {
  it('ida y vuelta: otro dispositivo queda con los mismos datos', async () => {
    const backup = await roundTrip(source);
    const target = await freshRepo();
    const counts = await target.importBackup(backup);

    expect(counts.vehicles).toBe(3);
    expect(await target.listVehicles()).toEqual(await source.listVehicles());
    expect(await target.listEntries()).toEqual(await source.listEntries());
    expect(await target.currentKmByVehicle()).toEqual(await source.currentKmByVehicle());
    expect(await target.listSchedules()).toEqual(await source.listSchedules());
  });

  it('importar dos veces no duplica nada', async () => {
    const backup = await roundTrip(source);
    const target = await freshRepo();
    await target.importBackup(backup);
    await target.importBackup(backup);
    expect(await target.listVehicles()).toHaveLength(3);
    expect((await target.listEntries()).length).toBe((await source.listEntries()).length);
  });

  it('fusiona: gana la versión más reciente de cada fila y se conserva lo local', async () => {
    const backup = await roundTrip(source);
    const target = await freshRepo(() => '2026-10-07T10:00:00.000Z');
    await target.importBackup(backup);

    // En el dispositivo se renombra un vehículo después de la copia y se añade otro.
    const [cbr] = await target.listVehicles();
    await target.updateVehicle(cbr!.id, { ...cbr!, name: 'CBR (local)', initial_km: null });
    await target.createVehicle(
      { name: 'Nueva', type: 'car', make: null, model: null, plate: null, first_registration: null, photo: null, initial_km: null },
      '2026-10-07',
    );

    await target.importBackup(backup); // la copia es más antigua: no pisa el cambio local
    const names = (await target.listVehicles()).map((v) => v.name);
    expect(names).toContain('CBR (local)');
    expect(names).toContain('Nueva');
    expect(names).toHaveLength(4);
  });

  it('acepta copias antiguas sin las columnas nuevas', async () => {
    const backup = JSON.parse(JSON.stringify(await source.exportBackup(SCHEMA)));
    for (const v of backup.data.vehicles) delete v.photo;
    for (const r of backup.data.odometer_readings) delete r.entry_id;
    backup.schema_version = 1;
    const parsed = parseBackup(JSON.stringify(backup), SCHEMA);
    expect(parsed.ok).toBe(true);
  });

  it('rechaza archivos que no son una copia, dañados o de una versión más nueva', async () => {
    expect(parseBackup('no es json', SCHEMA)).toMatchObject({ ok: false });
    expect(parseBackup('{"app":"otra"}', SCHEMA)).toMatchObject({ ok: false });

    const backup = JSON.parse(JSON.stringify(await source.exportBackup(SCHEMA)));
    backup.data.vehicles[0].type = 'avion';
    expect(parseBackup(JSON.stringify(backup), SCHEMA)).toMatchObject({ ok: false });

    backup.data.vehicles[0].type = 'car';
    backup.schema_version = SCHEMA + 1;
    const future = parseBackup(JSON.stringify(backup), SCHEMA);
    expect(future.ok).toBe(false);
    expect(!future.ok && future.error).toMatch(/más nueva/);
  });

  it('descarta columnas desconocidas en lugar de meterlas en la BD', async () => {
    const backup = JSON.parse(JSON.stringify(await source.exportBackup(SCHEMA)));
    backup.data.vehicles[0]['name = 1; DROP TABLE vehicles; --'] = 'x';
    const parsed = parseBackup(JSON.stringify(backup), SCHEMA);
    expect(parsed.ok).toBe(true);
    const target = await freshRepo();
    if (parsed.ok) await target.importBackup(parsed.backup);
    expect(await target.listVehicles()).toHaveLength(3);
  });
});

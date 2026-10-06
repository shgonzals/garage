import { addDays, subDays, subYears } from 'date-fns';
import { toIsoDate } from '@/domain/dates';
import type { TaskId, Vehicle } from '@/domain/types';
import type { GarageRepository } from './repository';

/** Matrículas de los vehículos de ejemplo: así se reconocen para no duplicarlos y para poder quitarlos. */
export const DEMO_PLATES: readonly string[] = ['1234KLM', '5678BCD', '9012FGH'];

export function isDemoVehicle(v: Pick<Vehicle, 'plate'>): boolean {
  return v.plate !== null && DEMO_PLATES.includes(v.plate);
}

/**
 * Datos de ejemplo parecidos al mockup (CBR600RR, Scrambler, Corolla).
 * Fechas relativas a hoy para que las urgencias se vean siempre igual.
 * Devuelve `false` (sin tocar nada) si ya estaban cargados.
 */
export async function seedDemoData(repo: GarageRepository, today = new Date()): Promise<boolean> {
  if ((await repo.listVehicles()).some(isDemoVehicle)) return false;

  const ago = (days: number) => toIsoDate(subDays(today, days));
  const yearsAgo = (years: number) => toIsoDate(subYears(today, years));
  const inDays = (days: number) => toIsoDate(addDays(today, days));
  const log = (vehicle_id: string, daysAgo: number, km: number, task_ids: TaskId[], cost: number | null = null, notes: string | null = null) =>
    repo.createEntry({ vehicle_id, done_on: ago(daysAgo), odometer_km: km, task_ids, cost, notes });

  const cbr = await repo.createVehicle(
    { name: 'CBR600RR', type: 'motorcycle', make: 'Honda', model: 'CBR600RR', plate: '1234KLM', first_registration: yearsAgo(7), insurance_due: inDays(20), road_tax_due: inDays(150), initial_km: 17500, photo: null },
    ago(400),
  );
  await log(cbr.id, 735, 15800, ['brake_fluid', 'coolant'], 85, 'Taller Motos Pepe');
  await log(cbr.id, 206, 18200, ['oil', 'air_filter'], 120.5);
  await log(cbr.id, 49, 22000, ['chain_tension', 'chain_lube']);
  await log(cbr.id, 3, 22700, ['chain_lube']);
  await log(cbr.id, 300, 17900, ['itv'], 38.6);
  await repo.addOdometerReading(cbr.id, 23050, ago(0));

  const scrambler = await repo.createVehicle(
    { name: 'Scrambler', type: 'motorcycle', make: 'Ducati', model: 'Scrambler Icon', plate: '5678BCD', first_registration: yearsAgo(2), insurance_due: inDays(240), road_tax_due: null, initial_km: 6000, photo: null },
    ago(300),
  );
  await log(scrambler.id, 90, 6500, ['oil'], 95);
  await log(scrambler.id, 20, 8000, ['chain_lube', 'chain_tension']);
  await repo.addOdometerReading(scrambler.id, 8410, ago(0));

  const corolla = await repo.createVehicle(
    { name: 'Corolla', type: 'car', make: 'Toyota', model: 'Corolla Hybrid', plate: '9012FGH', first_registration: yearsAgo(6), insurance_due: inDays(95), road_tax_due: inDays(60), initial_km: 135000, photo: null },
    ago(200),
  );
  await log(corolla.id, 60, 140000, ['oil', 'air_filter', 'brake_fluid', 'coolant', 'spark_plugs'], 310);
  await log(corolla.id, 100, 139000, ['itv'], 45);
  await log(corolla.id, 400, 125000, ['timing_belt'], 450);
  await repo.addOdometerReading(corolla.id, 142300, ago(0));
  return true;
}

/** Quita (borrado lógico) los vehículos de ejemplo. Los del usuario no se tocan. */
export async function removeDemoData(repo: GarageRepository): Promise<number> {
  const demo = (await repo.listVehicles()).filter(isDemoVehicle);
  for (const v of demo) await repo.deleteVehicle(v.id);
  return demo.length;
}

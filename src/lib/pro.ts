import { Capacitor, registerPlugin } from '@capacitor/core';
import { ref } from 'vue';
import { isDemoVehicle } from '@/db/demo';
import type { Vehicle } from '@/domain/types';

/**
 * Garage Pro: pago único en Google Play que desbloquea Gastos, los temas extra, más de
 * FREE_VEHICLES vehículos y el widget.
 *
 * La compra la valida Google Play (plugin nativo `GarageBilling`, android/app/src/main/java) y se
 * recuerda en el dispositivo para no esperar a Play al abrir la app; al arrancar se vuelve a
 * consultar, así una devolución o una compra en otro móvil con la misma cuenta se reflejan solas.
 *
 * Fuera de Android no hay tienda: en desarrollo (`npm run dev`, tests) la pantalla Pro tiene un
 * botón para activarlo y probar; en la web publicada no se puede comprar.
 */
export const PRO_PRODUCT_ID = 'garage_pro';
export const FREE_VEHICLES = 2;

export type PurchaseResult = 'purchased' | 'pending' | 'cancelled' | 'error';

interface GarageBillingPlugin {
  /** Precio en la moneda de la cuenta de Google ("1,99 €"); `null` si el producto no existe aún. */
  getProduct(options: { productId: string }): Promise<{ price: string | null }>;
  purchase(options: { productId: string }): Promise<{ result: PurchaseResult }>;
  /** ¿Lo tiene comprado esta cuenta de Google? (también sirve para "Restaurar compra"). */
  owned(options: { productId: string }): Promise<{ owned: boolean }>;
}

const GarageBilling = registerPlugin<GarageBillingPlugin>('GarageBilling');

export const billingSupported = Capacitor.getPlatform() === 'android';
/** Sin tienda (web): en desarrollo se puede activar Pro a mano para probar. */
export const devUnlock = !billingSupported && import.meta.env.DEV;

/** Gratis hasta FREE_VEHICLES vehículos propios (los de ejemplo no cuentan). */
export function canAddVehicle(vehicles: readonly Pick<Vehicle, 'plate'>[]): boolean {
  return isPro.value || vehicles.filter((v) => !isDemoVehicle(v)).length < FREE_VEHICLES;
}

/** El tema Taller es gratis; el resto, de Pro. */
export const FREE_PALETTE = 'taller';

const KEY = 'garage-pro';

function readCache(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const isPro = ref(readCache());

export function setPro(value: boolean) {
  isPro.value = value;
  try {
    if (value) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // sin almacenamiento: dura esta sesión
  }
}

/** Precio que muestra Google Play (o `null` fuera de Android / sin conexión). */
export async function proPrice(): Promise<string | null> {
  if (!billingSupported) return null;
  try {
    return (await GarageBilling.getProduct({ productId: PRO_PRODUCT_ID })).price;
  } catch {
    return null;
  }
}

/**
 * Vuelve a preguntar a Google Play. Devuelve `null` si no se pudo (sin conexión, sin cuenta de
 * Google…): entonces se queda con lo que había, no se quita Pro por un fallo de red.
 */
export async function refreshPro(): Promise<boolean | null> {
  if (!billingSupported) return isPro.value;
  try {
    const { owned } = await GarageBilling.owned({ productId: PRO_PRODUCT_ID });
    setPro(owned);
    return owned;
  } catch {
    return null;
  }
}

export async function buyPro(): Promise<PurchaseResult> {
  if (devUnlock) {
    setPro(true);
    return 'purchased';
  }
  if (!billingSupported) return 'error';
  try {
    const { result } = await GarageBilling.purchase({ productId: PRO_PRODUCT_ID });
    if (result === 'purchased') setPro(true);
    return result;
  } catch {
    return 'error';
  }
}

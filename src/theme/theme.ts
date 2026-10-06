import { ref, watch } from 'vue';

export type ThemePreference = 'system' | 'light' | 'dark';
export type PaletteId = 'taller' | 'britanico' | 'petroleo' | 'nocturno' | 'rosa';

/** Temas de color (palettes.css). `swatch`: fondo oscuro y acento, para el selector de Ajustes. */
export const PALETTES: readonly { id: PaletteId; label: string; swatch: [string, string] }[] = [
  { id: 'taller', label: 'Taller', swatch: ['#14171b', '#f5c518'] },
  { id: 'britanico', label: 'Británico', swatch: ['#0e1513', '#d4a94f'] },
  { id: 'petroleo', label: 'Petróleo', swatch: ['#0d171c', '#ff6b1a'] },
  { id: 'nocturno', label: 'Nocturno', swatch: ['#0a0f14', '#4fe0d0'] },
  { id: 'rosa', label: 'Neón', swatch: ['#151116', '#ff5fa2'] },
];

const STORAGE_KEY = 'garage-theme';
const PALETTE_KEY = 'garage-palette';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // almacenamiento no disponible: la preferencia solo dura esta sesión
  }
}

function loadMode(): ThemePreference {
  const v = read(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

function loadPalette(): PaletteId {
  const v = read(PALETTE_KEY);
  return PALETTES.some((p) => p.id === v) ? (v as PaletteId) : 'taller';
}

export const themePreference = ref<ThemePreference>(loadMode());
export const palettePreference = ref<PaletteId>(loadPalette());

function apply() {
  const root = document.documentElement;
  const dark = themePreference.value === 'dark' || (themePreference.value === 'system' && media.matches);
  // `ion-palette-dark` activa la paleta oscura de Ionic; nuestros tokens cuelgan de la misma clase.
  root.classList.toggle('ion-palette-dark', dark);
  root.dataset.palette = palettePreference.value;
  // Color de la barra del navegador / sistema en móvil.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--g-bg').trim());
}

export function initTheme() {
  apply();
  media.addEventListener('change', apply);
  watch(themePreference, (pref) => {
    write(STORAGE_KEY, pref);
    apply();
  });
  watch(palettePreference, (palette) => {
    write(PALETTE_KEY, palette);
    apply();
  });
}

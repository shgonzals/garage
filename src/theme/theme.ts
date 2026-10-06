import { ref, watch } from 'vue';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'garage-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function load(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export const themePreference = ref<ThemePreference>(load());

function apply() {
  const dark = themePreference.value === 'dark' || (themePreference.value === 'system' && media.matches);
  // `ion-palette-dark` activa la paleta oscura de Ionic; nuestros tokens cuelgan de la misma clase.
  document.documentElement.classList.toggle('ion-palette-dark', dark);
}

export function initTheme() {
  apply();
  media.addEventListener('change', apply);
  watch(themePreference, (pref) => {
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // almacenamiento no disponible: el tema solo dura esta sesión
    }
    apply();
  });
}

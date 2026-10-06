import { ref, watch } from 'vue';
import { createI18n } from 'vue-i18n';
import type { Locale as DateFnsLocale } from 'date-fns';
import { enGB, es as esDates } from 'date-fns/locale';
import en from './en';
import es, { type Messages } from './es';

/*
 * Idiomas de la app. El español es el original (y la reserva si falta una clave en inglés).
 * Fuera de los componentes se traduce con `t` (este módulo); dentro, con `$t` / `useI18n`.
 * Los textos cambian en caliente: `locale` es reactivo y los `computed` que llaman a `t` se recalculan.
 */
export type Locale = 'es' | 'en';
export type LanguagePreference = 'system' | Locale;

export const LANGUAGES: readonly { id: Locale; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
];

export const i18n = createI18n<[Messages], Locale, false>({
  legacy: false,
  locale: 'es',
  fallbackLocale: 'es',
  messages: { es, en },
  missingWarn: false,
  fallbackWarn: false,
});

export const t = i18n.global.t;

export function currentLocale(): Locale {
  return i18n.global.locale.value;
}

/** Locale de `Intl` (números, moneda). Inglés británico: fechas día/mes y € como en España. */
export function intlLocale(): string {
  return currentLocale() === 'en' ? 'en-GB' : 'es-ES';
}

export function dateLocale(): DateFnsLocale {
  return currentLocale() === 'en' ? enGB : esDates;
}

// ── Preferencia de idioma (Ajustes) ───────────────────────────

const STORAGE_KEY = 'garage-language';

function load(): LanguagePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'es' || v === 'en' ? v : 'system';
  } catch {
    return 'system';
  }
}

export const languagePreference = ref<LanguagePreference>(load());

/** Idioma del sistema: español si el móvil está en español; inglés para cualquier otro. */
export function systemLocale(languages: readonly string[] = navigator.languages ?? [navigator.language]): Locale {
  const first = languages[0]?.toLowerCase() ?? 'es';
  return first.startsWith('es') ? 'es' : 'en';
}

function apply() {
  const locale = languagePreference.value === 'system' ? systemLocale() : languagePreference.value;
  i18n.global.locale.value = locale;
  document.documentElement.lang = locale;
}

export function initLanguage() {
  apply();
  window.addEventListener('languagechange', apply);
  watch(languagePreference, (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // sin almacenamiento: dura esta sesión
    }
    apply();
  });
}

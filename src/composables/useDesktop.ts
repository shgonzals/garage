import { onScopeDispose, ref } from 'vue';

/** Mismo punto de corte que `ion-split-pane when="lg"` y las media queries de variables.css. */
export const DESKTOP_QUERY = '(min-width: 992px)';

/** `true` en pantallas anchas (ordenador / tablet en horizontal). */
export function useDesktop() {
  const query = window.matchMedia(DESKTOP_QUERY);
  const isDesktop = ref(query.matches);
  const onChange = (e: MediaQueryListEvent) => (isDesktop.value = e.matches);
  query.addEventListener('change', onChange);
  onScopeDispose(() => query.removeEventListener('change', onChange));
  return isDesktop;
}

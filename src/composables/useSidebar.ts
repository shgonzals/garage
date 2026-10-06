import { ref, watch } from 'vue';

const STORAGE_KEY = 'garage-sidebar-collapsed';

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Menú lateral de escritorio reducido a iconos. Se recuerda entre sesiones. */
export const sidebarCollapsed = ref(load());

watch(sidebarCollapsed, (collapsed) => {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // almacenamiento no disponible: la preferencia solo dura esta sesión
  }
});

import { App as CapApp } from '@capacitor/app';
import { onScopeDispose, watch } from 'vue';
import { useRouter } from 'vue-router';
import { widgetPayload } from '@/domain/widget';
import { i18n } from '@/i18n';
import { updateWidget, widgetRoute, widgetSupported } from '@/lib/widget';
import { useGarageStore } from '@/stores/garage';

/**
 * Mantiene al día el widget de Android (tras cada cambio de datos o de idioma) y abre la pantalla
 * que se toque en él: el registro rápido, un vehículo o los recordatorios.
 */
export function useWidgetSync() {
  if (!widgetSupported) return;
  const store = useGarageStore();
  const router = useRouter();

  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(
    [() => store.allReminders, () => store.vehicles, i18n.global.locale],
    () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        updateWidget(widgetPayload(store.vehicles, store.allReminders)).catch((err) =>
          console.error('No se pudo actualizar el widget', err),
        );
      }, 500);
    },
    { immediate: true },
  );
  onScopeDispose(() => clearTimeout(timer));

  const open = (url: string | undefined) => {
    const route = url ? widgetRoute(url) : null;
    if (route) void router.push(route);
  };
  // App ya abierta: llega como intent nuevo. App cerrada: es el intent con el que arrancó.
  void CapApp.addListener('appUrlOpen', ({ url }) => open(url));
  void CapApp.getLaunchUrl().then((launch) => open(launch?.url));
}

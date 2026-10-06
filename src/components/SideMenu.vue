<template>
  <ion-menu content-id="main" type="overlay" :disabled="!isDesktop" :swipe-gesture="false">
    <ion-content class="side" :class="{ collapsed: sidebarCollapsed }">
      <div class="brand">
        <span v-if="!sidebarCollapsed" class="brand-name"><AppLogo :size="26" /> Garage</span>
        <button
          type="button"
          class="icon-btn"
          :aria-label="sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'"
          :title="sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'"
          :aria-expanded="!sidebarCollapsed"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <ion-icon :icon="menuOutline" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        class="log"
        :disabled="store.vehicles.length === 0"
        :title="sidebarCollapsed ? 'Nuevo registro' : undefined"
        aria-label="Nuevo registro"
        @click="router.push('/log')"
      >
        <ion-icon :icon="flash" aria-hidden="true" />
        <span class="nav-label">Nuevo registro</span>
      </button>

      <nav aria-label="Secciones">
        <button
          v-for="item in NAV"
          :key="item.path"
          type="button"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          :aria-current="isActive(item.path) ? 'page' : undefined"
          :title="sidebarCollapsed ? item.label : undefined"
          @click="go(item.path)"
        >
          <span class="nav-icon"><ion-icon :icon="item.icon" aria-hidden="true" /></span>
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="item.path === '/tabs/reminders' && overdueCount > 0" class="badge">{{ overdueCount }}</span>
        </button>
      </nav>

      <template v-if="store.vehicles.length > 0">
        <h3 class="g-section-title vehicles-title">Vehículos</h3>
        <button
          v-for="v in store.vehicles"
          :key="v.id"
          type="button"
          class="nav-item vehicle"
          :class="{ active: route.path.startsWith(`/vehicles/${v.id}`) }"
          :title="sidebarCollapsed ? v.name : undefined"
          @click="router.push(`/vehicles/${v.id}`)"
        >
          <span class="nav-icon">
            <VehicleAvatar :photo="v.photo" :type="v.type" :size="24" />
            <span class="dot" :class="STATUS_TONE[store.summaries.get(v.id)?.status ?? 'unknown']" aria-hidden="true" />
          </span>
          <span class="nav-label">{{ v.name }}</span>
        </button>
        <button
          type="button"
          class="nav-item add"
          :title="sidebarCollapsed ? 'Añadir vehículo' : undefined"
          @click="router.push('/vehicles/new')"
        >
          <span class="nav-icon"><ion-icon :icon="add" aria-hidden="true" /></span>
          <span class="nav-label">Añadir vehículo</span>
        </button>
      </template>
    </ion-content>
  </ion-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { IonContent, IonIcon, IonMenu, useIonRouter } from '@ionic/vue';
import { add, alarmOutline, carSportOutline, flash, menuOutline, settingsOutline } from 'ionicons/icons';
import { useDesktop } from '@/composables/useDesktop';
import { sidebarCollapsed } from '@/composables/useSidebar';
import { useGarageStore } from '@/stores/garage';
import AppLogo from './AppLogo.vue';
import { STATUS_TONE } from './status';
import VehicleAvatar from './VehicleAvatar.vue';

const NAV = [
  { path: '/tabs/garage', label: 'Mi garage', icon: carSportOutline },
  { path: '/tabs/reminders', label: 'Recordatorios', icon: alarmOutline },
  { path: '/tabs/settings', label: 'Ajustes', icon: settingsOutline },
];

const store = useGarageStore();
const route = useRoute();
const router = useIonRouter();
const isDesktop = useDesktop();

const overdueCount = computed(() => store.allReminders.filter((r) => r.status === 'overdue').length);

function isActive(path: string) {
  return route.path.startsWith(path);
}

function go(path: string) {
  // Las secciones son raíces de navegación: sin animación de "atrás".
  router.navigate(path, 'root', 'replace');
}
</script>

<style scoped>
ion-menu {
  --border: none;
}
.side {
  --background: var(--g-surface);
  --padding-start: 12px;
  --padding-end: 12px;
  --padding-top: 14px;
  border-right: 1px solid var(--g-border);
}
.brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 0 0 0 8px;
  margin-bottom: 14px;
}
.brand-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--g-font-display);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: none;
  color: var(--g-text-secondary);
  font-size: 20px;
  cursor: pointer;
}
.icon-btn:hover {
  background: var(--g-surface-secondary);
  color: var(--g-text);
}

.log {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 38px;
  margin-bottom: 16px;
  border: none;
  border-radius: var(--g-radius-md);
  background: var(--g-accent);
  color: var(--g-on-accent);
  font-family: var(--g-font-display);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background var(--g-transition);
}
.log:hover {
  background: var(--g-accent-shade);
}
.log:disabled {
  opacity: 0.5;
  cursor: default;
}
.log .nav-label {
  flex: none;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: 10px;
  background: none;
  color: var(--g-text-secondary);
  cursor: pointer;
  transition: background var(--g-transition), color var(--g-transition);
}
.nav-item:hover {
  background: var(--g-surface-secondary);
  color: var(--g-text);
}
.nav-item.active {
  background: rgba(var(--g-accent-rgb), 0.14);
  color: var(--g-accent-text);
  font-weight: 600;
}
.nav-icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 20px;
  flex: none;
  font-size: 18px;
}
.nav-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--g-danger);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
}
.vehicles-title {
  margin: 24px 10px 6px;
  white-space: nowrap;
}
.vehicle .nav-icon {
  width: 24px;
  margin-inline: -2px;
}
.dot {
  position: absolute;
  right: -3px;
  bottom: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--g-surface);
  background: var(--g-neutral);
}
.dot.danger {
  background: var(--g-danger);
}
.dot.warning {
  background: var(--g-warning);
}
.dot.success {
  background: var(--g-success);
}
.add {
  color: var(--g-text-muted);
}

/* ── Contraído: solo iconos ─────────────────────────────────── */
.collapsed .brand {
  justify-content: center;
  padding: 0;
}
.collapsed .nav-label,
.collapsed .vehicles-title {
  display: none;
}
.collapsed .log {
  width: 38px;
  margin-inline: auto;
}
.collapsed .nav-item {
  justify-content: center;
  padding: 10px 0;
}
.collapsed .badge {
  position: absolute;
  top: 2px;
  right: 2px;
}
.collapsed nav {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--g-border);
}
</style>

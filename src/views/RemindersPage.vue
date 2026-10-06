<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Recordatorios</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Recordatorios</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-segment v-if="store.vehicles.length > 1" v-model="filter" :scrollable="true" class="filter">
        <ion-segment-button value="all">
          <ion-label>Todos</ion-label>
        </ion-segment-button>
        <ion-segment-button v-for="v in store.vehicles" :key="v.id" :value="v.id">
          <ion-label>{{ v.name }}</ion-label>
        </ion-segment-button>
      </ion-segment>

      <div v-if="reminders.length === 0" class="g-empty">
        <div class="g-empty-emoji">✅</div>
        <h2>Nada pendiente</h2>
        <p>Cuando registres mantenimientos, aquí verás qué toca y cuándo.</p>
      </div>

      <section v-for="group in groups" :key="group.status" class="g-section">
        <h3 class="g-section-title">{{ group.title }} · {{ group.items.length }}</h3>
        <div class="g-grid">
          <button
            v-for="r in group.items"
            :key="`${r.vehicleId}-${r.taskId}`"
            type="button"
            class="link"
            @click="router.push(`/vehicles/${r.vehicleId}`)"
          >
            <UrgencyCard :reminder="r" :vehicle-name="showVehicle ? store.vehicleById.get(r.vehicleId)?.name : undefined" />
          </button>
        </div>
      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonContent,
  IonHeader,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/vue';
import UrgencyCard from '@/components/UrgencyCard.vue';
import type { Urgency } from '@/domain/reminders';
import { useGarageStore } from '@/stores/garage';

const store = useGarageStore();
const router = useIonRouter();
const filter = ref<string>('all');

const GROUPS: { status: Urgency; title: string }[] = [
  { status: 'overdue', title: 'Vencidos' },
  { status: 'soon', title: 'Pronto' },
  { status: 'ok', title: 'Al día' },
  { status: 'unknown', title: 'Sin historial' },
];

const reminders = computed(() =>
  filter.value === 'all' ? store.allReminders : store.allReminders.filter((r) => r.vehicleId === filter.value),
);
const showVehicle = computed(() => filter.value === 'all' && store.vehicles.length > 1);

const groups = computed(() =>
  GROUPS.map((g) => ({ ...g, items: reminders.value.filter((r) => r.status === g.status) })).filter(
    (g) => g.items.length > 0,
  ),
);
</script>

<style scoped>
.filter {
  margin-bottom: 8px;
}
.link {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: var(--g-radius-md);
  transition: transform var(--g-transition), box-shadow var(--g-transition);
}
@media (min-width: 992px) {
  .link:hover {
    transform: translateY(-2px);
    box-shadow: var(--g-shadow-lg);
  }
  /* En rejilla, todas las tarjetas de una fila con la misma altura. */
  .link > :deep(.urgency) {
    height: 100%;
    margin-bottom: 0;
  }
  .filter {
    max-width: 640px;
    margin-bottom: 16px;
  }
}
</style>

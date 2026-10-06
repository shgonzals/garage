<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/garage" text="" />
        </ion-buttons>
        <ion-title>{{ vehicle?.name ?? 'Vehículo' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="vehicle" :router-link="`/vehicles/${id}/edit`">Editar</ion-button>
          <ion-button
            v-if="vehicle"
            class="g-desktop-only"
            fill="solid"
            shape="round"
            color="primary"
            :router-link="`/log?vehicle=${id}`"
          >
            <ion-icon slot="start" :icon="flash" />
            Registrar
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="!vehicle" class="g-empty">
        <div class="g-empty-emoji">🤷</div>
        <h2>Vehículo no encontrado</h2>
      </div>

      <template v-else>
        <!-- Cabecera: odómetro -->
        <div class="g-card hero">
          <VehicleAvatar :photo="vehicle.photo" :type="vehicle.type" :size="isDesktop ? 80 : 64" />
          <div class="hero-info">
            <div class="hero-sub">
              {{ [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicleTypeLabel(vehicle.type) }}
            </div>
            <div v-if="vehicle.plate" class="plate">{{ vehicle.plate }}</div>
          </div>
          <button type="button" class="odometer" @click="promptOdometer">
            <span class="odometer-km">{{ km !== null ? formatNumber(km) : '—' }}</span>
            <span class="odometer-unit">km · actualizar</span>
          </button>
        </div>

        <div class="columns">
          <!-- Urgencias -->
          <section class="g-section">
            <div class="section-head">
              <h3 class="g-section-title">Urgencias</h3>
              <ion-button fill="clear" size="small" :router-link="`/vehicles/${id}/plan`">Plan</ion-button>
            </div>
            <p v-if="reminders.length === 0" class="g-secondary">
              No hay mantenimientos programados. Configúralos en el plan.
            </p>
            <UrgencyCard v-for="r in visibleReminders" :key="r.taskId" :reminder="r" />
            <ion-button
              v-if="hiddenCount > 0"
              fill="clear"
              size="small"
              expand="block"
              @click="showAll = true"
            >
              Ver {{ hiddenCount }} más sin historial
            </ion-button>
          </section>

          <!-- Historial -->
          <section class="g-section">
            <h3 class="g-section-title">Historial</h3>
            <p v-if="entries.length === 0" class="g-secondary">
              Aún no hay registros. Pulsa ⚡ para apuntar el primero.
            </p>
            <ion-list v-else lines="none" class="timeline">
              <ion-item-sliding v-for="e in entries" :key="e.id">
                <ion-item class="timeline-item">
                  <div class="timeline-body">
                    <div class="timeline-date">
                      {{ formatDate(e.done_on) }}
                      <span v-if="e.odometer_km !== null" class="g-muted"> · {{ formatKm(e.odometer_km) }}</span>
                    </div>
                    <div class="chips">
                      <span v-for="item in e.items" :key="item.id" class="chip">
                        {{ getTask(item.task_id).emoji }} {{ getTask(item.task_id).label }}
                      </span>
                    </div>
                    <div v-if="e.cost_cents !== null || e.notes" class="timeline-meta g-secondary">
                      <span v-if="e.cost_cents !== null">{{ formatMoney(e.cost_cents, e.currency) }}</span>
                      <span v-if="e.cost_cents !== null && e.notes"> · </span>
                      <span v-if="e.notes">{{ e.notes }}</span>
                    </div>
                  </div>
                  <!-- En escritorio no hay gesto de deslizar: botón visible al pasar el ratón. -->
                  <ion-button
                    slot="end"
                    class="g-desktop-only delete"
                    fill="clear"
                    color="medium"
                    aria-label="Borrar registro"
                    @click="removeEntry(e.id)"
                  >
                    <ion-icon slot="icon-only" :icon="trashOutline" />
                  </ion-button>
                </ion-item>
                <ion-item-options side="end">
                  <ion-item-option color="danger" @click="removeEntry(e.id)">Borrar</ion-item-option>
                </ion-item-options>
              </ion-item-sliding>
            </ion-list>
          </section>
        </div>

        <ion-fab slot="fixed" vertical="bottom" horizontal="end">
          <ion-fab-button :router-link="`/log?vehicle=${id}`" aria-label="Registrar mantenimiento">
            <ion-icon :icon="flash" />
          </ion-fab-button>
        </ion-fab>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  alertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue';
import { flash, trashOutline } from 'ionicons/icons';
import UrgencyCard from '@/components/UrgencyCard.vue';
import VehicleAvatar from '@/components/VehicleAvatar.vue';
import { useDesktop } from '@/composables/useDesktop';
import { formatDate, formatKm, formatMoney, formatNumber } from '@/domain/format';
import { getTask, vehicleTypeLabel } from '@/domain/tasks';
import { useGarageStore } from '@/stores/garage';

const props = defineProps<{ id: string }>();
const store = useGarageStore();

const isDesktop = useDesktop();
const vehicle = computed(() => store.vehicleById.get(props.id) ?? null);
const km = computed(() => store.currentKm.get(props.id) ?? null);
const entries = computed(() => store.entriesByVehicle.get(props.id) ?? []);
const reminders = computed(() => store.remindersByVehicle.get(props.id) ?? []);

const showAll = ref(false);
const visibleReminders = computed(() =>
  showAll.value ? reminders.value : reminders.value.filter((r) => r.status !== 'unknown'),
);
const hiddenCount = computed(() => reminders.value.length - visibleReminders.value.length);

async function promptOdometer() {
  const alert = await alertController.create({
    header: 'Kilómetros actuales',
    inputs: [
      {
        name: 'km',
        type: 'number',
        value: km.value ?? undefined,
        attributes: { inputmode: 'numeric', min: 0 },
      },
    ],
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Guardar', role: 'confirm' },
    ],
  });
  await alert.present();
  const { role, data } = await alert.onDidDismiss<{ values: { km: string } }>();
  if (role !== 'confirm') return;

  const value = Number(data?.values.km);
  if (!Number.isInteger(value) || value < 0) {
    await toast('Introduce un número de km válido', 'danger');
    return;
  }
  if (km.value !== null && value < km.value) {
    await toast(`Los km no pueden bajar de ${formatKm(km.value)}`, 'danger');
    return;
  }
  await store.addReading(props.id, value);
}

async function removeEntry(entryId: string) {
  const alert = await alertController.create({
    header: '¿Borrar registro?',
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Borrar', role: 'destructive' },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role === 'destructive') await store.deleteEntry(entryId);
}

async function toast(message: string, color: string) {
  const t = await toastController.create({ message, color, duration: 2000, position: 'top' });
  await t.present();
}
</script>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  gap: 16px;
}
.hero-info {
  flex: 1;
  min-width: 0;
}
.hero-sub {
  font-weight: 600;
}
.plate {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 8px;
  border: 1px solid var(--g-border-strong);
  border-radius: 6px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--g-text-secondary);
}
.odometer {
  font: inherit;
  background: none;
  border: none;
  color: var(--g-text);
  text-align: right;
  cursor: pointer;
  padding: 4px;
}
.odometer-km {
  display: block;
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.odometer-unit {
  font-size: 12px;
  color: var(--ion-color-primary);
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-head .g-section-title {
  margin: 0;
}

/* Timeline */
.timeline {
  background: transparent;
  padding: 0;
}
.timeline-item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
}
.timeline-body {
  position: relative;
  padding: 0 0 20px 28px;
  width: 100%;
}
.timeline-body::before {
  content: '';
  position: absolute;
  left: 0;
  top: 5px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  box-shadow: 0 0 0 3px var(--g-bg);
}
.timeline-body::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 20px;
  bottom: 0;
  width: 2px;
  background: var(--g-border);
}
ion-item-sliding:last-child .timeline-body::after {
  display: none;
}
.timeline-date {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 6px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--g-surface-secondary);
  border: 1px solid var(--g-border);
}
.timeline-meta {
  margin-top: 6px;
  font-size: 13px;
}

@media (min-width: 992px) {
  .hero {
    padding: 20px 24px;
  }
  .odometer-km {
    font-size: 28px;
  }
  /* Urgencias a la izquierda, historial a la derecha. */
  .columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 40px;
    align-items: start;
  }
  .delete {
    align-self: flex-start;
    margin: 0;
    opacity: 0;
    transition: opacity var(--g-transition);
  }
  .timeline-item:hover .delete,
  .delete:focus-visible {
    opacity: 1;
  }
}
</style>

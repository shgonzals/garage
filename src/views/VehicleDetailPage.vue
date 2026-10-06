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

    <ion-content class="ion-padding g-has-fab">
      <div v-if="!vehicle" class="g-empty">
        <div class="g-empty-emoji">🤷</div>
        <h2>Vehículo no encontrado</h2>
      </div>

      <template v-else>
        <!-- Identidad -->
        <div class="identity">
          <VehicleAvatar :photo="vehicle.photo" :type="vehicle.type" :size="isDesktop ? 64 : 52" />
          <div class="identity-info">
            <div class="identity-name">
              {{ [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.name }}
            </div>
            <div class="identity-meta">
              <span v-if="vehicle.plate" class="plate">{{ vehicle.plate }}</span>
              <span>{{ vehicleTypeLabel(vehicle.type) }}</span>
            </div>
          </div>
        </div>

        <!-- Cuadro de instrumentos: odómetro + próximo mantenimiento + testigos -->
        <div class="dash">
          <OdometerCluster :km="km" :next="nextReminder" @update="promptOdometer" />
          <StatusLights v-if="reminders.length > 0" class="lights" :reminders="reminders" />
        </div>

        <div class="columns">
          <!-- Urgencias -->
          <section class="g-section">
            <div class="section-head">
              <h3 class="g-section-title g-hazard">Urgencias</h3>
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
            <h3 class="g-section-title">Partes de trabajo</h3>
            <p v-if="entries.length === 0" class="g-secondary">
              Aún no hay registros. Pulsa ⚡ para apuntar el primero.
            </p>
            <div v-else class="work work-head" aria-hidden="true">
              <span>Fecha</span>
              <span>Km</span>
              <span>Trabajo</span>
            </div>
            <ion-list v-if="entries.length > 0" lines="none" class="timeline">
              <ion-item-sliding v-for="e in entries" :key="e.id">
                <ion-item class="timeline-item">
                  <!-- Tocar el registro lo abre para corregirlo. -->
                  <button
                    type="button"
                    class="work timeline-body"
                    :aria-label="`Editar registro del ${formatDate(e.done_on)}`"
                    @click="router.push(`/entries/${e.id}/edit`)"
                  >
                    <span class="g-mono">{{ formatNumericDate(e.done_on) }}</span>
                    <span class="g-mono">{{ e.odometer_km !== null ? formatNumber(e.odometer_km) : '—' }}</span>
                    <span class="work-desc">
                      <span class="work-tasks">{{ e.items.map((i) => getTask(i.task_id).label).join(', ') }}</span>
                      <span v-if="e.cost_cents !== null || e.notes" class="work-meta">
                        <span v-if="e.cost_cents !== null" class="g-mono">{{ formatMoney(e.cost_cents, e.currency) }}</span>
                        <span v-if="e.cost_cents !== null && e.notes"> · </span>
                        <span v-if="e.notes">{{ e.notes }}</span>
                      </span>
                    </span>
                  </button>
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
  useIonRouter,
} from '@ionic/vue';
import { flash, trashOutline } from 'ionicons/icons';
import OdometerCluster from '@/components/OdometerCluster.vue';
import StatusLights from '@/components/StatusLights.vue';
import UrgencyCard from '@/components/UrgencyCard.vue';
import VehicleAvatar from '@/components/VehicleAvatar.vue';
import { useDesktop } from '@/composables/useDesktop';
import { formatDate, formatKm, formatMoney, formatNumber, formatNumericDate } from '@/domain/format';
import { getTask, vehicleTypeLabel } from '@/domain/tasks';
import { useGarageStore } from '@/stores/garage';

const props = defineProps<{ id: string }>();
const store = useGarageStore();
const router = useIonRouter();

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
/** El más urgente con datos: lo que marca el arco del cuadro. */
const nextReminder = computed(() => reminders.value.find((r) => r.status !== 'unknown') ?? null);

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
    message: '¿Te equivocaste antes? Corrígelo en el historial de km.',
    buttons: [
      { text: 'Historial', role: 'history' },
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Guardar', role: 'confirm' },
    ],
  });
  await alert.present();
  const { role, data } = await alert.onDidDismiss<{ values: { km: string } }>();
  if (role === 'history') {
    router.push(`/vehicles/${props.id}/km`);
    return;
  }
  if (role !== 'confirm') return;

  const value = Number(data?.values.km);
  if (!Number.isInteger(value) || value < 0) {
    await toast('Introduce un número de km válido', 'danger');
    return;
  }
  if (km.value !== null && value < km.value) {
    await toast(`Los km no pueden bajar de ${formatKm(km.value)}. Si es un error, corrígelo en el historial de km.`, 'danger');
    return;
  }
  await store.addReading(props.id, value);
}

async function removeEntry(entryId: string) {
  const alert = await alertController.create({
    header: '¿Borrar registro?',
    message: 'También se quitarán los km que apuntaste en él.',
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
/* Identidad */
.identity {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}
.identity-info {
  min-width: 0;
}
.identity-name {
  font-family: var(--g-font-display);
  font-weight: 700;
  font-size: 20px;
  letter-spacing: 0.02em;
  line-height: 1.1;
}
.identity-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 13px;
  color: var(--g-text-muted);
}
/* Placa de matrícula: invertida respecto al fondo, como una chapa. */
.plate {
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--g-text);
  color: var(--g-bg);
  font-family: var(--g-font-mono);
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.06em;
}

/* Cuadro */
.dash {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
}
.section-head .g-section-title {
  flex: 1;
  margin: 0;
}

/* Partes de trabajo: tabla de fecha · km · trabajo */
.work {
  display: grid;
  grid-template-columns: 72px 64px minmax(0, 1fr);
  column-gap: 8px;
  align-items: baseline;
}
.work-head {
  padding: 0 0 8px;
  border-bottom: 1px solid var(--g-border-strong);
  font-family: var(--g-font-mono);
  font-size: 11px;
  text-transform: uppercase;
  color: var(--g-text-muted);
}
.timeline {
  background: transparent;
  padding: 0;
}
.timeline-item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
  --min-height: 0;
  border-bottom: 1px solid var(--g-border);
}
.timeline-body {
  width: 100%;
  padding: 11px 0;
  font: inherit;
  font-size: 13px;
  color: inherit;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
}
.timeline-body:hover .work-tasks {
  color: var(--g-accent-text);
}
.work-desc {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.work-tasks {
  font-size: 14px;
  font-weight: 500;
}
.work-meta {
  font-size: 12px;
  color: var(--g-text-muted);
}

@media (min-width: 992px) {
  /* Cuadro a la izquierda, testigos apilados a la derecha. */
  .dash {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: 16px;
  }
  .dash > .lights {
    grid-template-columns: 1fr;
    align-content: center;
  }
  /* Urgencias a la izquierda, partes de trabajo a la derecha. */
  .columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 40px;
    align-items: start;
  }
  .delete {
    align-self: center;
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

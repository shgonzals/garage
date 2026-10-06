<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/garage" text="" />
        </ion-buttons>
        <ion-title>{{ vehicle?.name ?? $t('common.vehicle') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="vehicle" :router-link="`/vehicles/${id}/edit`">{{ $t('common.edit') }}</ion-button>
          <ion-button
            v-if="vehicle"
            class="g-desktop-only"
            fill="solid"
            shape="round"
            color="primary"
            :router-link="`/log?vehicle=${id}`"
          >
            <ion-icon slot="start" :icon="flash" />
            {{ $t('detail.log') }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding g-has-fab">
      <div v-if="!vehicle" class="g-empty">
        <div class="g-empty-emoji">🤷</div>
        <h2>{{ $t('detail.notFound') }}</h2>
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
          <OdometerCluster :km="km" :next="nextReminder" :unit="unit" @update="promptOdometer" />
          <StatusLights v-if="reminders.length > 0" class="lights" :reminders="reminders" />
        </div>

        <div class="columns">
          <!-- Urgencias -->
          <section class="g-section">
            <div class="section-head">
              <h3 class="g-section-title g-hazard">{{ $t('detail.urgent') }}</h3>
              <ion-button fill="clear" size="small" :router-link="`/vehicles/${id}/plan`">{{ $t('detail.plan') }}</ion-button>
            </div>
            <p v-if="reminders.length === 0" class="g-secondary">
              {{ $t('detail.noPlan') }}
            </p>
            <UrgencyCard v-for="r in visibleReminders" :key="r.taskId" :reminder="r" actions />
            <ion-button
              v-if="hiddenCount > 0"
              fill="clear"
              size="small"
              expand="block"
              @click="showAll = true"
            >
              {{ $t('detail.showMore', { n: hiddenCount }) }}
            </ion-button>
          </section>

          <!-- Historial -->
          <section class="g-section">
            <h3 class="g-section-title">{{ $t('detail.history') }}</h3>
            <p v-if="history.length === 0" class="g-secondary">
              {{ $t('detail.noHistory') }}
            </p>
            <div v-else class="work work-head" aria-hidden="true">
              <span>{{ $t('common.date') }}</span>
              <span>{{ unit === 'km' ? $t('common.km') : $t('common.hours') }}</span>
              <span>{{ $t('detail.work') }}</span>
            </div>
            <ion-list v-if="history.length > 0" lines="none" class="timeline">
              <template v-for="h in history" :key="h.item.id">
              <ion-item-sliding v-if="h.kind === 'fuel'">
                <ion-item class="timeline-item">
                  <button
                    type="button"
                    class="work timeline-body"
                    :aria-label="$t('detail.editFuelAria', { date: formatDate(h.item.filled_on) })"
                    @click="router.push(`/fuel/${h.item.id}/edit`)"
                  >
                    <span class="g-mono">{{ formatNumericDate(h.item.filled_on) }}</span>
                    <span class="g-mono">{{ h.item.odometer_km !== null ? formatNumber(h.item.odometer_km) : '—' }}</span>
                    <span class="work-desc">
                      <span class="work-tasks">⛽ {{ $t('logMode.fuel') }} · <span class="g-mono">{{ formatLiters(h.item.centiliters) }}</span></span>
                      <span v-if="h.item.cost_cents !== null || h.item.notes || !h.item.full_tank" class="work-meta">
                        <span v-if="h.item.cost_cents !== null" class="g-mono">{{ formatMoney(h.item.cost_cents, h.item.currency) }}</span>
                        <span v-if="!h.item.full_tank">{{ h.item.cost_cents !== null ? ' · ' : '' }}{{ $t('detail.partial') }}</span>
                        <span v-if="h.item.notes"> · {{ h.item.notes }}</span>
                      </span>
                    </span>
                  </button>
                  <ion-button
                    slot="end"
                    class="g-desktop-only delete"
                    fill="clear"
                    color="medium"
                    :aria-label="$t('fuel.delete')"
                    @click="removeFuel(h.item.id)"
                  >
                    <ion-icon slot="icon-only" :icon="trashOutline" />
                  </ion-button>
                </ion-item>
                <ion-item-options side="end">
                  <ion-item-option color="danger" @click="removeFuel(h.item.id)">{{ $t('common.delete') }}</ion-item-option>
                </ion-item-options>
              </ion-item-sliding>
              <ion-item-sliding v-else>
                <ion-item class="timeline-item">
                  <!-- Tocar el registro lo abre para corregirlo. -->
                  <button
                    type="button"
                    class="work timeline-body"
                    :aria-label="$t('detail.editEntryAria', { date: formatDate(h.item.done_on) })"
                    @click="router.push(`/entries/${h.item.id}/edit`)"
                  >
                    <span class="g-mono">{{ formatNumericDate(h.item.done_on) }}</span>
                    <span class="g-mono">{{ h.item.odometer_km !== null ? formatNumber(h.item.odometer_km) : '—' }}</span>
                    <span class="work-desc">
                      <span class="work-tasks">{{ h.item.items.map((i) => getTask(i.task_id).label).join(', ') }}</span>
                      <span v-if="h.item.cost_cents !== null || h.item.notes" class="work-meta">
                        <span v-if="h.item.cost_cents !== null" class="g-mono">{{ formatMoney(h.item.cost_cents, h.item.currency) }}</span>
                        <span v-if="h.item.cost_cents !== null && h.item.notes"> · </span>
                        <span v-if="h.item.notes">{{ h.item.notes }}</span>
                      </span>
                    </span>
                  </button>
                  <!-- En escritorio no hay gesto de deslizar: botón visible al pasar el ratón. -->
                  <ion-button
                    slot="end"
                    class="g-desktop-only delete"
                    fill="clear"
                    color="medium"
                    :aria-label="$t('detail.deleteEntry')"
                    @click="removeEntry(h.item.id)"
                  >
                    <ion-icon slot="icon-only" :icon="trashOutline" />
                  </ion-button>
                </ion-item>
                <ion-item-options side="end">
                  <ion-item-option color="danger" @click="removeEntry(h.item.id)">{{ $t('common.delete') }}</ion-item-option>
                </ion-item-options>
              </ion-item-sliding>
              </template>
            </ion-list>
          </section>
        </div>

        <ion-fab slot="fixed" vertical="bottom" horizontal="end">
          <ion-fab-button :router-link="`/log?vehicle=${id}`" :aria-label="$t('garage.logService')">
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
import { formatDate, formatLiters, formatMoney, formatNumber, formatNumericDate, formatUsage } from '@/domain/format';
import { t } from '@/i18n';
import { UNITS, usageUnit } from '@/domain/units';
import { getTask, vehicleTypeLabel } from '@/domain/tasks';
import { useGarageStore } from '@/stores/garage';

const props = defineProps<{ id: string }>();
const store = useGarageStore();
const router = useIonRouter();

const isDesktop = useDesktop();
const vehicle = computed(() => store.vehicleById.get(props.id) ?? null);
const km = computed(() => store.currentKm.get(props.id) ?? null);
const unit = computed(() => usageUnit(vehicle.value?.type ?? 'motorcycle'));
const entries = computed(() => store.entriesByVehicle.get(props.id) ?? []);
const fuelLogs = computed(() => store.fuelLogs.filter((f) => f.vehicle_id === props.id));
/** Partes de trabajo y repostajes en una sola línea de tiempo, lo último arriba. */
const history = computed(() =>
  [
    ...entries.value.map((item) => ({ kind: 'entry' as const, item, on: item.done_on, km: item.odometer_km })),
    ...fuelLogs.value.map((item) => ({ kind: 'fuel' as const, item, on: item.filled_on, km: item.odometer_km })),
  ].sort((a, b) => b.on.localeCompare(a.on) || (b.km ?? 0) - (a.km ?? 0)),
);
const reminders = computed(() => store.remindersByVehicle.get(props.id) ?? []);

const showAll = ref(false);
const visibleReminders = computed(() =>
  showAll.value ? reminders.value : reminders.value.filter((r) => r.status !== 'unknown'),
);
const hiddenCount = computed(() => reminders.value.length - visibleReminders.value.length);
/** El más urgente con datos: lo que marca el arco del cuadro. */
const nextReminder = computed(
  () => reminders.value.find((r) => r.status !== 'unknown' && r.status !== 'snoozed') ?? null,
);

async function promptOdometer() {
  const alert = await alertController.create({
    header: UNITS[unit.value].current,
    inputs: [
      {
        name: 'km',
        type: 'number',
        value: km.value ?? undefined,
        attributes: { inputmode: 'numeric', min: 0 },
      },
    ],
    message: t(unit.value === 'km' ? 'detail.fixKm' : 'detail.fixHours'),
    buttons: [
      { text: t('detail.history'), role: 'history' },
      { text: t('common.cancel'), role: 'cancel' },
      { text: t('common.save'), role: 'confirm' },
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
    await toast(t('odometer.invalid'), 'danger');
    return;
  }
  if (km.value !== null && value < km.value) {
    await toast(
      t('detail.cantGoDown', { value: formatUsage(km.value, unit.value) }),
      'danger',
    );
    return;
  }
  await store.addReading(props.id, value);
}

async function removeFuel(fuelId: string) {
  const alert = await alertController.create({
    header: t('fuel.deleteHeader'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      { text: t('common.delete'), role: 'destructive' },
    ],
  });
  await alert.present();
  if ((await alert.onDidDismiss()).role === 'destructive') await store.deleteFuel(fuelId);
}

async function removeEntry(entryId: string) {
  const alert = await alertController.create({
    header: t('detail.deleteEntryHeader'),
    message: t('detail.deleteEntryMessage', { what: UNITS[unit.value].noun }),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      { text: t('common.delete'), role: 'destructive' },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role === 'destructive') await store.deleteEntry(entryId);
}

async function toast(message: string, color: string) {
  const toastEl = await toastController.create({ message, color, duration: 2000, position: 'top' });
  await toastEl.present();
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

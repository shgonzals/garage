<template>
  <ion-page class="g-narrow">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/vehicles/${id}`" text="" />
        </ion-buttons>
        <ion-title>{{ info.title }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <p class="g-secondary intro">
        <i18n-t :keypath="unit === 'km' ? 'odometer.introKm' : 'odometer.introHours'" scope="global">
          <template #name><strong>{{ vehicle?.name }}</strong></template>
        </i18n-t>
      </p>

      <form class="add" @submit.prevent="add">
        <ion-input
          v-model="kmText"
          :label="$t('odometer.newReading', { unit })"
          label-placement="stacked"
          fill="outline"
          type="number"
          inputmode="numeric"
          :min="0"
          :placeholder="current !== null ? String(current) : '0'"
        />
        <ion-button type="submit" shape="round" :disabled="saving">{{ $t('common.add') }}</ion-button>
      </form>
      <p v-if="error" class="g-error">{{ error }}</p>

      <p v-if="suspicious.size > 0" class="warning">
        ⚠️ {{ $t('odometer.suspicious', { n: suspicious.size }, suspicious.size) }}
      </p>

      <section class="g-section">
        <h3 class="g-section-title">{{ $t('odometer.history') }} · {{ readings.length }}</h3>
        <p v-if="readings.length === 0" class="g-secondary">{{ $t('odometer.empty') }}</p>
        <div v-else class="g-card list">
          <div
            v-for="r in readings"
            :key="r.id"
            class="reading"
            :class="{ bad: suspicious.has(r.id), current: r.km === current }"
          >
            <div class="reading-main">
              <span class="reading-km">{{ formatUsage(r.km, unit) }}</span>
              <span v-if="r.km === current" class="tag">{{ $t('odometer.current') }}</span>
              <span v-if="suspicious.has(r.id)" class="tag tag-bad">{{ $t('odometer.error') }}</span>
            </div>
            <div class="reading-sub g-secondary">
              {{ formatDate(r.read_on) }} · {{ r.entry_id ? $t('odometer.fromEntry') : r.fuel_id ? $t('odometer.fromFuel') : $t('odometer.manual') }}
            </div>
            <ion-button
              v-if="r.entry_id"
              class="reading-action"
              fill="clear"
              size="small"
              :router-link="`/entries/${r.entry_id}/edit`"
            >
              {{ $t('odometer.editEntry') }}
            </ion-button>
            <ion-button
              v-else-if="r.fuel_id"
              class="reading-action"
              fill="clear"
              size="small"
              :router-link="`/fuel/${r.fuel_id}/edit`"
            >
              {{ $t('odometer.editFuel') }}
            </ion-button>
            <ion-button
              v-else
              class="reading-action"
              fill="clear"
              size="small"
              color="danger"
              :aria-label="$t('odometer.deleteAria', { value: formatUsage(r.km, unit) })"
              @click="remove(r)"
            >
              <ion-icon slot="icon-only" :icon="trashOutline" />
            </ion-button>
          </div>
        </div>
      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  alertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { trashOutline } from 'ionicons/icons';
import { formatDate, formatUsage } from '@/domain/format';
import { t } from '@/i18n';
import { UNITS, usageUnit } from '@/domain/units';
import { suspiciousReadings } from '@/domain/odometer';
import type { OdometerReading } from '@/domain/types';
import { useGarageStore } from '@/stores/garage';

const props = defineProps<{ id: string }>();
const store = useGarageStore();

const vehicle = computed(() => store.vehicleById.get(props.id));
const current = computed(() => store.currentKm.get(props.id) ?? null);
const readings = ref<OdometerReading[]>([]);
const unit = computed(() => usageUnit(vehicle.value?.type ?? 'motorcycle'));
const info = computed(() => UNITS[unit.value]);
const suspicious = computed(() => suspiciousReadings(readings.value, info.value.maxPerDay));

const kmText = ref('');
const error = ref<string | null>(null);
const saving = ref(false);

async function load() {
  readings.value = await store.listReadings(props.id);
}
// Recarga al volver de editar un registro (el store se recarga y cambian los km).
watch([() => store.entries, () => store.fuelLogs], load, { immediate: true });

async function add() {
  const km = Number(String(kmText.value ?? '').trim());
  if (String(kmText.value ?? '').trim() === '' || !Number.isInteger(km) || km < 0) {
    error.value = t('odometer.invalid');
    return;
  }
  if (current.value !== null && km < current.value) {
    error.value = t('odometer.lower', { value: formatUsage(current.value, unit.value) });
    return;
  }
  error.value = null;
  saving.value = true;
  try {
    await store.addReading(props.id, km);
    kmText.value = '';
    await load();
  } finally {
    saving.value = false;
  }
}

async function remove(r: OdometerReading) {
  const alert = await alertController.create({
    header: t('odometer.deleteHeader', { value: formatUsage(r.km, unit.value) }),
    message: t('odometer.deleteMessage', { date: formatDate(r.read_on) }),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      { text: t('common.delete'), role: 'destructive' },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role !== 'destructive') return;
  await store.deleteReading(r.id);
  await load();
}
</script>

<style scoped>
.intro {
  margin-top: 0;
  font-size: 14px;
}
.add {
  display: flex;
  align-items: center;
  gap: 12px;
}
.add ion-input {
  flex: 1;
}
.warning {
  margin: 16px 0 0;
  padding: 12px 14px;
  border-radius: var(--g-radius-md);
  border: 1px solid var(--g-border-warning);
  background: var(--g-bg-warning);
  color: var(--g-text-warning);
  font-size: 13px;
}
.list {
  padding: 4px 0;
}
.reading {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    'main action'
    'sub action';
  align-items: center;
  column-gap: 8px;
  padding: 10px 8px 10px 16px;
  border-bottom: 1px solid var(--g-border);
}
.reading:last-child {
  border-bottom: none;
}
.reading.bad {
  background: var(--g-bg-warning);
}
.reading-main {
  grid-area: main;
  display: flex;
  align-items: center;
  gap: 8px;
}
.reading-km {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.reading-sub {
  grid-area: sub;
  font-size: 12px;
}
.reading-action {
  grid-area: action;
}
.tag {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(var(--g-accent-rgb), 0.16);
  color: var(--g-accent-text);
}
.tag-bad {
  background: var(--g-bg-danger);
  color: var(--g-text-danger);
}
</style>

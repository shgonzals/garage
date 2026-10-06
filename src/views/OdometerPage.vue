<template>
  <ion-page class="g-narrow">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/vehicles/${id}`" text="" />
        </ion-buttons>
        <ion-title>Kilómetros</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <p class="g-secondary intro">
        Los km actuales de <strong>{{ vehicle?.name }}</strong> son la lectura más alta. Si alguna está mal, bórrala
        aquí; las que vienen de un registro se corrigen editando ese registro.
      </p>

      <form class="add" @submit.prevent="add">
        <ion-input
          v-model="kmText"
          label="Nueva lectura (km)"
          label-placement="stacked"
          fill="outline"
          type="number"
          inputmode="numeric"
          :min="0"
          :placeholder="current !== null ? String(current) : '0'"
        />
        <ion-button type="submit" shape="round" :disabled="saving">Añadir</ion-button>
      </form>
      <p v-if="error" class="g-error">{{ error }}</p>

      <p v-if="suspicious.size > 0" class="warning">
        ⚠️ {{ suspicious.size === 1 ? 'Hay una lectura que no cuadra' : `Hay ${suspicious.size} lecturas que no cuadran` }}
        con el resto. Seguramente sea un error al teclear.
      </p>

      <section class="g-section">
        <h3 class="g-section-title">Historial · {{ readings.length }}</h3>
        <p v-if="readings.length === 0" class="g-secondary">Aún no hay lecturas.</p>
        <div v-else class="g-card list">
          <div
            v-for="r in readings"
            :key="r.id"
            class="reading"
            :class="{ bad: suspicious.has(r.id), current: r.km === current }"
          >
            <div class="reading-main">
              <span class="reading-km">{{ formatKm(r.km) }}</span>
              <span v-if="r.km === current" class="tag">Actual</span>
              <span v-if="suspicious.has(r.id)" class="tag tag-bad">¿Error?</span>
            </div>
            <div class="reading-sub g-secondary">
              {{ formatDate(r.read_on) }} · {{ r.entry_id ? 'De un registro' : 'Manual' }}
            </div>
            <ion-button
              v-if="r.entry_id"
              class="reading-action"
              fill="clear"
              size="small"
              :router-link="`/entries/${r.entry_id}/edit`"
            >
              Editar registro
            </ion-button>
            <ion-button
              v-else
              class="reading-action"
              fill="clear"
              size="small"
              color="danger"
              :aria-label="`Borrar lectura de ${formatKm(r.km)}`"
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
import { formatDate, formatKm } from '@/domain/format';
import { suspiciousReadings } from '@/domain/odometer';
import type { OdometerReading } from '@/domain/types';
import { useGarageStore } from '@/stores/garage';

const props = defineProps<{ id: string }>();
const store = useGarageStore();

const vehicle = computed(() => store.vehicleById.get(props.id));
const current = computed(() => store.currentKm.get(props.id) ?? null);
const readings = ref<OdometerReading[]>([]);
const suspicious = computed(() => suspiciousReadings(readings.value));

const kmText = ref('');
const error = ref<string | null>(null);
const saving = ref(false);

async function load() {
  readings.value = await store.listReadings(props.id);
}
// Recarga al volver de editar un registro (el store se recarga y cambian los km).
watch(() => store.entries, load, { immediate: true });

async function add() {
  const km = Number(String(kmText.value ?? '').trim());
  if (String(kmText.value ?? '').trim() === '' || !Number.isInteger(km) || km < 0) {
    error.value = 'Introduce un número de km válido';
    return;
  }
  if (current.value !== null && km < current.value) {
    error.value = `Es menor que la lectura actual (${formatKm(current.value)}). Si esa está mal, bórrala primero.`;
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
    header: `¿Borrar ${formatKm(r.km)}?`,
    message: `Lectura del ${formatDate(r.read_on)}.`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Borrar', role: 'destructive' },
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

<template>
  <ion-page class="g-narrow">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/garage" text="" />
        </ion-buttons>
        <ion-title>{{ editing ? 'Editar repostaje' : 'Repostaje' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="saving" @click="save">Guardar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="fuelId && !editing" class="g-empty">
        <div class="g-empty-emoji">🤷</div>
        <h2>Repostaje no encontrado</h2>
      </div>

      <div v-else-if="store.vehicles.length === 0" class="g-empty">
        <div class="g-empty-emoji">⛽</div>
        <h2>Primero añade un vehículo</h2>
        <ion-button router-link="/vehicles/new" shape="round">Añadir vehículo</ion-button>
      </div>

      <form v-else @submit.prevent="save">
        <LogModeSwitch v-if="!editing" mode="fuel" :vehicle-id="vehicleId" />
        <VehiclePicker v-if="!editing" :model-value="vehicleId" @update:model-value="selectVehicle" />

        <div class="row">
          <ion-input
            v-model="kmText"
            class="big-input"
            :label="unit === 'km' ? 'Km' : 'Horas'"
            label-placement="stacked"
            fill="outline"
            type="number"
            inputmode="numeric"
            :min="0"
            placeholder="0"
          />
          <ion-input v-model="filledOn" class="flex" label="Fecha" label-placement="stacked" fill="outline" type="date" :max="store.today" />
        </div>
        <p v-if="errors.odometer_km" class="g-error">{{ errors.odometer_km }}</p>

        <div class="row amounts">
          <ion-input
            v-model="litersText"
            class="big-input"
            label="Litros"
            label-placement="stacked"
            fill="outline"
            inputmode="decimal"
            placeholder="0,0"
          />
          <ion-input
            v-model="costText"
            class="big-input"
            label="Importe (€)"
            label-placement="stacked"
            fill="outline"
            inputmode="decimal"
            placeholder="Opcional"
          />
        </div>
        <p v-if="errors.liters" class="g-error">{{ errors.liters }}</p>
        <p v-if="errors.cost" class="g-error">{{ errors.cost }}</p>
        <p v-if="pricePerLiter" class="g-secondary price g-mono">{{ pricePerLiter }} €/L</p>

        <div class="g-card full">
          <div>
            <div class="full-label">Depósito lleno</div>
            <div class="g-secondary full-hint">Llenando siempre hasta arriba se calcula el consumo real.</div>
          </div>
          <ion-toggle v-model="fullTank" aria-label="Depósito lleno" />
        </div>

        <ion-textarea
          v-model="notes"
          class="notes"
          label="Notas"
          label-placement="stacked"
          fill="outline"
          :auto-grow="true"
          placeholder="Gasolinera, tipo de combustible…"
        />

        <ion-button type="submit" expand="block" shape="round" size="large" class="save" :disabled="saving">
          {{ editing ? 'Guardar cambios' : 'Guardar repostaje' }}
        </ion-button>
        <ion-button v-if="editing" expand="block" fill="clear" color="danger" class="delete" @click="remove">
          Borrar repostaje
        </ion-button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  alertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  toastController,
  useIonRouter,
} from '@ionic/vue';
import LogModeSwitch from '@/components/LogModeSwitch.vue';
import VehiclePicker from '@/components/VehiclePicker.vue';
import { formatLiters } from '@/domain/format';
import { fuelInputSchema, litersToCentiliters } from '@/domain/fuel';
import { fieldErrors } from '@/domain/schemas';
import { usageUnit } from '@/domain/units';
import { useGarageStore } from '@/stores/garage';

/** Con `fuelId` (ruta `/fuel/:fuelId/edit`) la página edita ese repostaje. */
const props = defineProps<{ fuelId?: string }>();
const store = useGarageStore();
const route = useRoute();
const router = useIonRouter();

const editing = props.fuelId ? store.fuelLogs.find((f) => f.id === props.fuelId) : undefined;

const initialVehicle =
  editing?.vehicle_id ??
  (typeof route.query.vehicle === 'string' && store.vehicleById.has(route.query.vehicle)
    ? route.query.vehicle
    : (store.vehicles[0]?.id ?? ''));

const vehicleId = ref(initialVehicle);
const unit = computed(() => usageUnit(store.vehicleById.get(vehicleId.value)?.type ?? 'motorcycle'));
const decimal = (n: number) => String(n).replace('.', ',');

const kmText = ref(
  editing ? (editing.odometer_km?.toString() ?? '') : (store.currentKm.get(initialVehicle)?.toString() ?? ''),
);
function selectVehicle(id: string) {
  vehicleId.value = id;
  kmText.value = store.currentKm.get(id)?.toString() ?? '';
}
const filledOn = ref(editing?.filled_on ?? store.today);
const litersText = ref(editing ? decimal(editing.centiliters / 100) : '');
const costText = ref(editing?.cost_cents != null ? decimal(editing.cost_cents / 100) : '');
const fullTank = ref(editing ? editing.full_tank === 1 : true);
const notes = ref(editing?.notes ?? '');
const errors = ref<Record<string, string>>({});
const saving = ref(false);

/** "1.234,50" → 1234.5 (es-ES); "65.5" también vale. */
function parseNumber(text: string | number | null | undefined): number | null {
  let s = String(text ?? '').trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return s === '' ? null : Number(s);
}

const pricePerLiter = computed(() => {
  const liters = parseNumber(litersText.value);
  const cost = parseNumber(costText.value);
  if (!liters || !cost || liters <= 0) return null;
  return (Math.round((cost / liters) * 1000) / 1000).toFixed(3).replace('.', ',');
});

async function save() {
  const parsed = fuelInputSchema.safeParse({
    vehicle_id: vehicleId.value,
    filled_on: filledOn.value,
    odometer_km: parseNumber(kmText.value),
    liters: parseNumber(litersText.value) ?? undefined,
    cost: parseNumber(costText.value),
    full_tank: fullTank.value,
    notes: notes.value,
  });
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error);
    return;
  }
  errors.value = {};
  saving.value = true;
  try {
    if (editing) await store.updateFuel(editing.id, parsed.data);
    else await store.logFuel(parsed.data);
    leave(parsed.data.vehicle_id, editing ? 'Cambios guardados ✓' : `Repostaje guardado: ${formatLiters(litersToCentiliters(parsed.data.liters))} ✓`);
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!editing) return;
  const alert = await alertController.create({
    header: '¿Borrar repostaje?',
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Borrar', role: 'destructive' },
    ],
  });
  await alert.present();
  if ((await alert.onDidDismiss()).role !== 'destructive') return;
  await store.deleteFuel(editing.id);
  leave(editing.vehicle_id, 'Repostaje borrado');
}

function leave(id: string, message: string) {
  if (router.canGoBack()) router.back();
  else router.replace(`/vehicles/${id}`);
  void toastController.create({ message, color: 'success', duration: 1500, position: 'top' }).then((t) => t.present());
}
</script>

<style scoped>
.row {
  display: flex;
  gap: 12px;
}
.amounts {
  margin-top: 12px;
}
.big-input {
  flex: 1;
  font-family: var(--g-font-mono);
  font-size: 22px;
  font-weight: 700;
}
.flex {
  flex: 1;
}
.price {
  margin: 6px 4px 0;
  font-size: 13px;
  text-align: right;
}
.full {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}
.full-label {
  font-weight: 600;
}
.full-hint {
  font-size: 13px;
}
.notes {
  margin-top: 12px;
}
.save {
  margin-top: 24px;
}
.delete {
  margin-top: 8px;
}
</style>

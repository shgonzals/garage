<template>
  <ion-page class="g-narrow">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/garage" text="" />
        </ion-buttons>
        <ion-title>Registro rápido</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="saving" @click="save">Guardar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="store.vehicles.length === 0" class="g-empty">
        <div class="g-empty-emoji">🏍️</div>
        <h2>Primero añade un vehículo</h2>
        <ion-button router-link="/vehicles/new" shape="round">Añadir vehículo</ion-button>
      </div>

      <form v-else @submit.prevent="save">
        <!-- Vehículo -->
        <div v-if="store.vehicles.length > 1" class="vehicle-picker" role="radiogroup" aria-label="Vehículo">
          <button
            v-for="v in store.vehicles"
            :key="v.id"
            type="button"
            role="radio"
            :aria-checked="v.id === vehicleId"
            class="pick"
            :class="{ active: v.id === vehicleId }"
            @click="selectVehicle(v.id)"
          >
            <VehicleAvatar :photo="v.photo" :type="v.type" :size="24" />
            {{ v.name }}
          </button>
        </div>
        <p v-if="errors.vehicle_id" class="g-error">{{ errors.vehicle_id }}</p>

        <!-- Km + fecha -->
        <div class="row">
          <ion-input
            v-model="kmText"
            class="big-input"
            label="Km"
            label-placement="stacked"
            fill="outline"
            type="number"
            inputmode="numeric"
            :min="0"
            placeholder="0"
          />
          <ion-input
            v-model="doneOn"
            class="date-input"
            label="Fecha"
            label-placement="stacked"
            fill="outline"
            type="date"
            :max="store.today"
          />
        </div>
        <p v-if="errors.odometer_km" class="g-error">{{ errors.odometer_km }}</p>
        <p v-if="errors.done_on" class="g-error">{{ errors.done_on }}</p>

        <!-- Tareas -->
        <h3 class="g-section-title tasks-title">¿Qué has hecho?</h3>
        <div class="tasks">
          <button
            v-for="t in orderedTasks"
            :key="t.id"
            type="button"
            class="task"
            :class="{ active: selected.has(t.id), suggested: suggested.has(t.id) }"
            :aria-pressed="selected.has(t.id)"
            @click="toggle(t.id)"
          >
            <span aria-hidden="true">{{ t.emoji }}</span>
            {{ t.label }}
          </button>
        </div>
        <p v-if="errors.task_ids" class="g-error">{{ errors.task_ids }}</p>

        <!-- Opcional -->
        <div class="row optional">
          <ion-input
            v-model="costText"
            label="Coste (€)"
            label-placement="stacked"
            fill="outline"
            inputmode="decimal"
            placeholder="Opcional"
          />
        </div>
        <p v-if="errors.cost" class="g-error">{{ errors.cost }}</p>
        <ion-textarea
          v-model="notes"
          class="notes"
          label="Notas"
          label-placement="stacked"
          fill="outline"
          :auto-grow="true"
          placeholder="Taller, marca del aceite…"
        />

        <ion-button type="submit" expand="block" shape="round" size="large" class="save" :disabled="saving">
          Guardar registro
        </ion-button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonTextarea,
  IonTitle,
  IonToolbar,
  toastController,
  useIonRouter,
} from '@ionic/vue';
import VehicleAvatar from '@/components/VehicleAvatar.vue';
import { fieldErrors, quickLogSchema } from '@/domain/schemas';
import { TASKS } from '@/domain/tasks';
import type { TaskId } from '@/domain/types';
import { useGarageStore } from '@/stores/garage';

const store = useGarageStore();
const route = useRoute();
const router = useIonRouter();

const initialVehicle =
  typeof route.query.vehicle === 'string' && store.vehicleById.has(route.query.vehicle)
    ? route.query.vehicle
    : (store.vehicles[0]?.id ?? '');

const vehicleId = ref(initialVehicle);
const kmText = ref(kmFor(initialVehicle));
const doneOn = ref(store.today);
const selected = ref(new Set<TaskId>());
const costText = ref('');
const notes = ref('');
const errors = ref<Record<string, string>>({});
const saving = ref(false);

function kmFor(id: string): string {
  const km = store.currentKm.get(id);
  return km !== undefined ? String(km) : '';
}

function selectVehicle(id: string) {
  vehicleId.value = id;
  kmText.value = kmFor(id);
  selected.value = new Set();
}

const suggested = computed(() => new Set(store.suggestedTasks(vehicleId.value)));

/** Las tareas vencidas o próximas van primero: suele ser lo que se acaba de hacer. */
const orderedTasks = computed(() => [
  ...TASKS.filter((t) => suggested.value.has(t.id)),
  ...TASKS.filter((t) => !suggested.value.has(t.id)),
]);

function toggle(id: TaskId) {
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selected.value = next;
}

function parseNumber(text: string | number | null | undefined): number | null {
  const s = String(text ?? '').trim().replace(',', '.');
  return s === '' ? null : Number(s);
}

async function save() {
  const parsed = quickLogSchema.safeParse({
    vehicle_id: vehicleId.value,
    done_on: doneOn.value,
    odometer_km: parseNumber(kmText.value),
    task_ids: [...selected.value],
    cost: parseNumber(costText.value),
    notes: notes.value,
  });
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error);
    return;
  }
  errors.value = {};
  saving.value = true;
  try {
    await store.logEntry(parsed.data);
    if (router.canGoBack()) router.back();
    else router.replace(`/vehicles/${parsed.data.vehicle_id}`);
    // Sin await: la navegación no espera a la animación del toast.
    void toastController
      .create({ message: 'Registro guardado ✓', color: 'success', duration: 1500, position: 'top' })
      .then((t) => t.present());
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.vehicle-picker {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-bottom: 16px;
}
.pick {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  padding: 5px 14px 5px 5px;
  border-radius: 999px;
  border: 1px solid var(--g-border);
  background: var(--g-surface);
  color: var(--g-text);
  cursor: pointer;
}
.pick.active {
  background: var(--ion-color-primary);
  border-color: var(--ion-color-primary);
  color: #fff;
  box-shadow: var(--g-shadow-md);
}
.row {
  display: flex;
  gap: 12px;
}
.big-input {
  flex: 1;
  font-size: 22px;
  font-weight: 700;
}
.date-input {
  flex: 1;
}
.tasks-title {
  margin-top: 24px;
}
.tasks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.task {
  font: inherit;
  font-size: 14px;
  text-align: left;
  padding: 12px;
  border-radius: var(--g-radius-md);
  border: 1px solid var(--g-border);
  background: var(--g-surface);
  color: var(--g-text);
  cursor: pointer;
  transition: all var(--g-transition);
}
.task.suggested {
  border-color: var(--g-border-warning);
  background: var(--g-bg-warning);
  color: var(--g-text-warning);
}
.task.active {
  background: var(--ion-color-primary);
  border-color: var(--ion-color-primary);
  color: #fff;
  box-shadow: var(--g-shadow-md);
}
.optional {
  margin-top: 24px;
}
.notes {
  margin-top: 12px;
}
.save {
  margin-top: 24px;
}
</style>

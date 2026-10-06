<template>
  <ion-page class="g-narrow">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/garage" text="" />
        </ion-buttons>
        <ion-title>{{ editing ? $t('odometer.editEntry') : $t('quickLog.title') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="saving" @click="save">{{ $t('common.save') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div v-if="entryId && !editing" class="g-empty">
        <div class="g-empty-emoji">🤷</div>
        <h2>{{ $t('quickLog.notFound') }}</h2>
      </div>

      <div v-else-if="store.vehicles.length === 0" class="g-empty">
        <div class="g-empty-emoji">🏍️</div>
        <h2>{{ $t('common.addVehicleFirst') }}</h2>
        <ion-button router-link="/vehicles/new" shape="round">{{ $t('common.addVehicle') }}</ion-button>
      </div>

      <form v-else @submit.prevent="save">
        <LogModeSwitch v-if="!editing" mode="maintenance" :vehicle-id="vehicleId" />
        <!-- Vehículo (al editar no se cambia: el registro pertenece a su historial) -->
        <VehiclePicker v-if="!editing" :model-value="vehicleId" @update:model-value="selectVehicle" />
        <p v-if="errors.vehicle_id" class="g-error">{{ errors.vehicle_id }}</p>

        <!-- Km + fecha -->
        <div class="row">
          <ion-input
            v-model="kmText"
            class="big-input"
            :label="unit === 'km' ? $t('common.km') : $t('common.hours')"
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
            :label="$t('common.date')"
            label-placement="stacked"
            fill="outline"
            type="date"
            :max="store.today"
          />
        </div>
        <p v-if="errors.odometer_km" class="g-error">{{ errors.odometer_km }}</p>
        <p v-if="errors.done_on" class="g-error">{{ errors.done_on }}</p>

        <!-- Tareas -->
        <h3 class="g-section-title tasks-title">{{ $t('quickLog.whatDone') }}</h3>
        <!-- Lo relevante: lo que toca ahora, lo del plan y lo ya marcado -->
        <div class="tasks">
          <button
            v-for="t in primaryTasks"
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

        <!-- El resto del catálogo, plegado y con buscador -->
        <button
          v-if="otherTasks.length > 0"
          type="button"
          class="more-toggle"
          :aria-expanded="moreOpen"
          @click="moreOpen = !moreOpen"
        >
          <ion-icon :icon="moreOpen ? removeIcon : addIcon" aria-hidden="true" />
          {{ $t('quickLog.moreTasks') }}
          <span class="g-muted more-count">{{ otherTasks.length }}</span>
        </button>
        <div v-if="moreOpen" class="more">
          <ion-input
            v-model="search"
            class="search"
            :label="$t('quickLog.search')"
            label-placement="stacked"
            fill="outline"
            :placeholder="$t('quickLog.searchPlaceholder')"
            :clear-input="true"
          />
          <div v-for="group in otherGroups" :key="group.id" class="more-group">
            <h4 class="more-title">{{ group.label }}</h4>
            <div class="tasks">
              <button
                v-for="t in group.tasks"
                :key="t.id"
                type="button"
                class="task"
                :aria-pressed="false"
                @click="toggle(t.id)"
              >
                <span aria-hidden="true">{{ t.emoji }}</span>
                {{ t.label }}
              </button>
            </div>
          </div>
          <p v-if="otherGroups.length === 0" class="g-secondary">{{ $t('quickLog.noMatch', { q: search }) }}</p>
        </div>

        <!-- Opcional -->
        <div class="row optional">
          <ion-input
            v-model="costText"
            :label="$t('quickLog.cost')"
            label-placement="stacked"
            fill="outline"
            inputmode="decimal"
            :placeholder="$t('common.optional')"
          />
        </div>
        <p v-if="errors.cost" class="g-error">{{ errors.cost }}</p>
        <ion-textarea
          v-model="notes"
          class="notes"
          :label="$t('common.notes')"
          label-placement="stacked"
          fill="outline"
          :auto-grow="true"
          :placeholder="$t('quickLog.notesPlaceholder')"
        />

        <ion-button type="submit" expand="block" shape="round" size="large" class="save" :disabled="saving">
          {{ editing ? $t('common.saveChanges') : $t('quickLog.save') }}
        </ion-button>
        <ion-button v-if="editing" expand="block" fill="clear" color="danger" class="delete" @click="remove">
          {{ $t('detail.deleteEntry') }}
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
  IonIcon,
  IonInput,
  IonPage,
  IonTextarea,
  IonTitle,
  IonToolbar,
  alertController,
  toastController,
  useIonRouter,
} from '@ionic/vue';
import { add as addIcon, remove as removeIcon } from 'ionicons/icons';
import LogModeSwitch from '@/components/LogModeSwitch.vue';
import VehiclePicker from '@/components/VehiclePicker.vue';
import { fieldErrors, quickLogSchema } from '@/domain/schemas';
import { getTask, TASK_CATEGORIES } from '@/domain/tasks';
import { formatDecimal, parseDecimal } from '@/domain/format';
import { t } from '@/i18n';
import { UNITS, usageUnit } from '@/domain/units';
import type { TaskId } from '@/domain/types';
import { useGarageStore } from '@/stores/garage';

/** Con `entryId` (ruta `/entries/:entryId/edit`) la página edita ese registro. */
const props = defineProps<{ entryId?: string }>();
const store = useGarageStore();
const route = useRoute();
const router = useIonRouter();

const editing = props.entryId ? store.entries.find((e) => e.id === props.entryId) : undefined;

const initialVehicle =
  editing?.vehicle_id ??
  (typeof route.query.vehicle === 'string' && store.vehicleById.has(route.query.vehicle)
    ? route.query.vehicle
    : (store.vehicles[0]?.id ?? ''));

const vehicleId = ref(initialVehicle);
/** Unidad del vehículo elegido: km, u horas de motor en pit bike y kart. */
const unit = computed(() => usageUnit(store.vehicleById.get(vehicleId.value)?.type ?? 'motorcycle'));
const kmText = ref(editing ? (editing.odometer_km?.toString() ?? '') : kmFor(initialVehicle));
const doneOn = ref(editing?.done_on ?? store.today);
const selected = ref(new Set<TaskId>(editing?.items.map((i) => i.task_id)));
const costText = ref(editing?.cost_cents != null ? formatDecimal(editing.cost_cents / 100, 2) : '');
const notes = ref(editing?.notes ?? '');
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

const suggested = computed(() => new Set(editing ? [] : store.suggestedTasks(vehicleId.value)));

/** Las tareas vencidas o próximas van primero: suele ser lo que se acaba de hacer. */
const vehicleTasks = computed(() => {
  const tasks = store.tasksFor(vehicleId.value);
  // Al editar, una tarea personalizada ya borrada del plan sigue apareciendo si el registro la tiene.
  const missing = [...selected.value].filter((id) => !tasks.some((t) => t.id === id)).map(getTask);
  return [...tasks, ...missing];
});
/** Tareas con plan activo en el vehículo, y vencimientos por fecha que tienen recordatorio. */
const relevant = computed(() => {
  const ids = new Set<TaskId>(
    store.schedules.filter((s) => s.vehicle_id === vehicleId.value && s.enabled).map((s) => s.task_id),
  );
  for (const r of store.remindersByVehicle.get(vehicleId.value) ?? []) ids.add(r.taskId);
  ids.add('other');
  return ids;
});

/**
 * Arriba: lo que toca ahora (vencido o pronto), lo del plan y lo ya marcado. Lo que se marca desde
 * "Más tareas" sube aquí, para ver siempre todo lo que se va a guardar.
 */
const primaryTasks = computed(() => {
  const shown = vehicleTasks.value.filter(
    (t) => selected.value.has(t.id) || suggested.value.has(t.id) || relevant.value.has(t.id),
  );
  // Al editar, orden fijo: las sugerencias de "ahora" no aplican a un registro pasado.
  if (editing) return shown;
  return [...shown.filter((t) => suggested.value.has(t.id)), ...shown.filter((t) => !suggested.value.has(t.id))];
});

const moreOpen = ref(false);
const search = ref('');
const otherTasks = computed(() => vehicleTasks.value.filter((t) => !primaryTasks.value.includes(t)));

/** Sin tildes ni mayúsculas: "embrague" encuentra "Líquido de embrague". */
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const otherGroups = computed(() => {
  const q = normalize(String(search.value ?? '').trim());
  const matching = otherTasks.value.filter((t) => !q || normalize(t.label).includes(q));
  return TASK_CATEGORIES.map((c) => ({ ...c, tasks: matching.filter((t) => t.category === c.id) })).filter(
    (g) => g.tasks.length > 0,
  );
});

function toggle(id: TaskId) {
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selected.value = next;
}

async function save() {
  const parsed = quickLogSchema.safeParse({
    vehicle_id: vehicleId.value,
    done_on: doneOn.value,
    odometer_km: parseDecimal(kmText.value),
    task_ids: [...selected.value],
    cost: parseDecimal(costText.value),
    notes: notes.value,
  });
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error);
    return;
  }
  errors.value = {};
  saving.value = true;
  try {
    if (editing) await store.updateEntry(editing.id, parsed.data);
    else await store.logEntry(parsed.data);
    leave(parsed.data.vehicle_id, editing ? t('common.changesSaved') : t('quickLog.saved'));
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!editing) return;
  const alert = await alertController.create({
    header: t('detail.deleteEntryHeader'),
    message: editing.odometer_km !== null ? t('detail.deleteEntryMessage', { what: UNITS[unit.value].noun }) : undefined,
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      { text: t('common.delete'), role: 'destructive' },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role !== 'destructive') return;
  await store.deleteEntry(editing.id);
  leave(editing.vehicle_id, t('quickLog.deleted'));
}

function leave(vehicleId: string, message: string) {
  if (router.canGoBack()) router.back();
  else router.replace(`/vehicles/${vehicleId}`);
  // Sin await: la navegación no espera a la animación del toast.
  void toastController
    .create({ message, color: 'success', duration: 1500, position: 'top' })
    .then((t) => t.present());
}
</script>

<style scoped>
.row {
  display: flex;
  gap: 12px;
}
.big-input {
  flex: 1;
  font-family: var(--g-font-mono);
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
  background: var(--g-accent);
  border-color: var(--g-accent);
  color: var(--g-on-accent);
  box-shadow: var(--g-shadow-md);
}
.more-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  margin-top: 10px;
  padding: 0 12px;
  border: 1px dashed var(--g-border-strong);
  border-radius: var(--g-radius-md);
  background: none;
  color: var(--g-text);
  font-family: var(--g-font-display);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}
.more-toggle ion-icon {
  font-size: 18px;
  color: var(--g-accent-text);
}
.more-count {
  margin-left: auto;
  font-family: var(--g-font-mono);
  font-size: 12px;
  letter-spacing: 0;
}
.more {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}
.more-title {
  margin: 0 0 6px;
  font-family: var(--g-font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--g-text-secondary);
}
.optional {
  margin-top: 24px;
}
.notes {
  margin-top: 12px;
}
.delete {
  margin-top: 8px;
}
.save {
  margin-top: 24px;
}
</style>

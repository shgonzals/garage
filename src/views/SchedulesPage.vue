<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/vehicles/${id}`" text="" />
        </ion-buttons>
        <ion-title>Plan de mantenimiento</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="saving" @click="save">Guardar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <p class="g-secondary intro">
        {{ unit === 'km' ? 'Cada cuántos km' : 'Cada cuántas horas' }} o años toca cada tarea en <strong>{{ vehicle?.name }}</strong>. Lo que llegue antes manda.
        <template v-if="isRoadVehicle(vehicleType)">ITV, seguro e impuesto van por fecha: se configuran en el vehículo.</template>
      </p>

      <p v-if="activeGroups.length === 0" class="g-secondary empty">
        Aún no hay tareas en el plan. Añádelas desde el catálogo.
      </p>

      <!-- Tareas activas, por categoría -->
      <section v-for="group in activeGroups" :key="group.id" class="g-section">
        <h3 class="g-section-title">{{ group.label }}</h3>
        <div class="g-grid">
          <!-- Compacta: una línea con el resumen; al tocarla se despliega para editar. -->
          <div
            v-for="row in group.rows"
            :key="row.taskId"
            class="g-card task"
            :class="{ off: !row.enabled, open: row.open }"
            :data-task="row.taskId"
          >
            <div class="task-head">
              <button
                type="button"
                class="task-summary"
                :aria-expanded="row.open"
                :aria-label="`${taskLabel(row.taskId)}: ${intervalSummary(row)}. Editar`"
                @click="row.open = !row.open"
              >
                <span class="task-label">{{ taskEmoji(row.taskId) }} {{ taskLabel(row.taskId) }}</span>
                <span class="task-interval">{{ intervalSummary(row) }}</span>
              </button>
              <ion-icon class="chevron" :icon="row.open ? chevronUp : chevronDown" aria-hidden="true" />
              <ion-toggle v-model="row.enabled" :aria-label="`Activar ${taskLabel(row.taskId)}`" />
            </div>
            <template v-if="row.open">
              <div v-if="row.enabled" class="row">
                <ion-input v-model="row.km" :label="`Cada (${unit})`" label-placement="stacked" fill="outline" type="number" inputmode="numeric" placeholder="—" :min="1" />
                <ion-input v-model="row.years" label="Cada (años)" label-placement="stacked" fill="outline" type="number" inputmode="decimal" placeholder="—" :min="0.5" step="0.5" />
              </div>
              <p v-if="row.enabled && row.suggested" class="g-secondary suggested">Valor orientativo: revisa el manual.</p>
              <div v-if="isCustomTaskId(row.taskId)" class="custom-actions">
                <ion-button fill="clear" size="small" @click="rename(row)">
                  <ion-icon slot="start" :icon="createOutline" />
                  Renombrar
                </ion-button>
                <ion-button fill="clear" size="small" color="danger" @click="removeTask(row)">
                  <ion-icon slot="start" :icon="trashOutline" />
                  Borrar
                </ion-button>
              </div>
            </template>
            <p v-if="row.error" class="g-error">{{ row.error }}</p>
          </div>
        </div>
      </section>

      <!-- Catálogo: lo que no está en el plan -->
      <section class="g-section catalog">
        <button type="button" class="catalog-toggle" :aria-expanded="catalogOpen" @click="catalogOpen = !catalogOpen">
          <ion-icon :icon="catalogOpen ? removeIcon : addIcon" aria-hidden="true" />
          <span>Catálogo de tareas</span>
          <span class="g-muted catalog-count">{{ available.length }} del catálogo</span>
        </button>

        <div v-if="catalogOpen" class="catalog-body">
          <div v-for="group in availableGroups" :key="group.id" class="catalog-group">
            <h4 class="catalog-title">{{ group.label }}</h4>
            <div class="chips">
              <button v-for="row in group.rows" :key="row.taskId" type="button" class="chip" @click="activate(row)">
                <span aria-hidden="true">{{ taskEmoji(row.taskId) }}</span>
                {{ taskLabel(row.taskId) }}
                <ion-icon :icon="addIcon" aria-hidden="true" />
              </button>
            </div>
          </div>
          <p v-if="available.length === 0" class="g-secondary">Ya tienes todo el catálogo en el plan.</p>

          <!-- Tarea propia: se crea al momento, sin esperar a "Guardar" -->
          <form class="g-card task new" @submit.prevent="addTask">
            <div class="task-label">Crear tarea propia</div>
            <ion-input
              v-model="draft.label"
              label="Nombre"
              label-placement="stacked"
              fill="outline"
              placeholder="Escobillas, cubrecárter…"
              :maxlength="40"
            />
            <div class="emojis" role="radiogroup" aria-label="Icono">
              <button
                v-for="e in CUSTOM_TASK_EMOJIS"
                :key="e"
                type="button"
                role="radio"
                class="emoji"
                :class="{ active: draft.emoji === e }"
                :aria-checked="draft.emoji === e"
                @click="draft.emoji = e"
              >
                {{ e }}
              </button>
            </div>
            <div class="row">
              <ion-input v-model="draft.km" :label="`Cada (${unit})`" label-placement="stacked" fill="outline" type="number" inputmode="numeric" placeholder="—" :min="1" />
              <ion-input v-model="draft.years" label="Cada (años)" label-placement="stacked" fill="outline" type="number" inputmode="decimal" placeholder="—" :min="0.5" step="0.5" />
            </div>
            <p v-if="draft.error" class="g-error">{{ draft.error }}</p>
            <ion-button type="submit" expand="block" class="add-custom" :disabled="adding">
              <ion-icon slot="start" :icon="addIcon" />
              Crear tarea
            </ion-button>
          </form>
        </div>
      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue';
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
  IonToggle,
  IonToolbar,
  toastController,
  useIonRouter,
} from '@ionic/vue';
import { add as addIcon, chevronDown, chevronUp, createOutline, remove as removeIcon, trashOutline } from 'ionicons/icons';
import { formatNumber } from '@/domain/format';
import { customTaskInputSchema, scheduleInputSchema, type ScheduleInput } from '@/domain/schemas';
import {
  CUSTOM_TASK_EMOJIS,
  DATED_TASKS,
  getTask,
  isCustomTaskId,
  isRoadVehicle,
  suggestedInterval,
  TASK_CATEGORIES,
  tasksForType,
  YEAR,
} from '@/domain/tasks';
import type { CustomTaskId, TaskId } from '@/domain/types';
import { usageUnit } from '@/domain/units';
import { useGarageStore } from '@/stores/garage';

const props = defineProps<{ id: string }>();
const store = useGarageStore();
const router = useIonRouter();
const saving = ref(false);

const vehicle = computed(() => store.vehicleById.get(props.id));
const vehicleType = vehicle.value?.type ?? 'motorcycle';
/** km, u horas de motor en pit bike y kart: los intervalos se escriben en esa unidad. */
const unit = usageUnit(vehicleType);
const current = new Map(store.schedules.filter((s) => s.vehicle_id === props.id).map((s) => [s.task_id, s]));
/** Tareas que ya tenían plan: las que no, si siguen desactivadas, no se guardan. */
const planned = new Set<TaskId>(current.keys());

interface Row {
  taskId: TaskId;
  enabled: boolean;
  /** Visible arriba (activa o tocada en esta sesión): al desactivarla no salta de sitio hasta guardar. */
  shown: boolean;
  km: string;
  years: string;
  /** Intervalo rellenado con el valor orientativo del catálogo. */
  suggested: boolean;
  /** Desplegada para editar el intervalo. */
  open: boolean;
  error: string | null;
}

/** 730 → "2"; 548 → "1.5". Redondeado a medio año. */
function daysToYears(days: number): string {
  return String(Math.round((days / YEAR) * 2) / 2);
}

function rowFor(taskId: TaskId, forceShown = false): Row {
  const s = current.get(taskId);
  const enabled = s?.enabled ?? false;
  return {
    taskId,
    enabled,
    shown: enabled || forceShown,
    km: s?.interval_km ? String(s.interval_km) : '',
    years: s?.interval_days ? daysToYears(s.interval_days) : '',
    suggested: false,
    open: false,
    error: null,
  };
}

/** Resumen de una línea: "Cada 6.000 km · 1 año", "Cada 2 años", "Sin intervalo". */
function intervalSummary(row: Row): string {
  if (!row.enabled) return 'Desactivada';
  const km = toNumber(row.km);
  const years = toNumber(row.years);
  const parts = [
    km ? `${formatNumber(km)} ${unit}` : null,
    years ? `${String(years).replace('.', ',')} ${years === 1 ? 'año' : 'años'}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `Cada ${parts.join(' · ')}` : 'Sin intervalo';
}

// Catálogo aplicable al tipo de vehículo + cualquier tarea que ya tuviera plan (p. ej. si cambió de tipo).
const catalogIds = new Set<TaskId>(tasksForType(vehicleType).map((t) => t.id));
for (const id of current.keys()) if (!isCustomTaskId(id)) catalogIds.add(id);
const rows = reactive<Row[]>([
  ...[...catalogIds].filter((id) => !DATED_TASKS.includes(id) && id !== 'other').map((id) => rowFor(id)),
  ...store.customTasks.filter((t) => t.vehicle_id === props.id && !t.deleted_at).map((t) => rowFor(t.id, true)),
]);

const categoryOf = (id: TaskId): string => (isCustomTaskId(id) ? 'propias' : getTask(id).category);
const GROUPS = [...TASK_CATEGORIES.filter((c) => c.id !== 'otros'), { id: 'propias', label: 'Tus tareas' }];

function grouped(list: Row[]) {
  return GROUPS.map((g) => ({ ...g, rows: list.filter((r) => categoryOf(r.taskId) === g.id) })).filter(
    (g) => g.rows.length > 0,
  );
}
const activeGroups = computed(() => grouped(rows.filter((r) => r.shown)));
const available = computed(() => rows.filter((r) => !r.shown));
const availableGroups = computed(() => grouped(available.value));
const catalogOpen = ref(false);

// Nombre e icono desde el store, que es reactivo: al renombrar una propia se actualiza la tarjeta.
function taskLabel(id: TaskId): string {
  return store.customTasks.find((t) => t.id === id)?.label ?? getTask(id).label;
}
function taskEmoji(id: TaskId): string {
  return store.customTasks.find((t) => t.id === id)?.emoji ?? getTask(id).emoji;
}

/** Del catálogo al plan: activa la tarea con su intervalo orientativo y la lleva a la vista. */
async function activate(row: Row) {
  row.enabled = true;
  row.shown = true;
  row.open = true;
  if (!row.km && !row.years) {
    const interval = suggestedInterval(getTask(row.taskId), vehicleType);
    if (interval) {
      row.km = interval.km ? String(interval.km) : '';
      row.years = interval.days ? daysToYears(interval.days) : '';
      row.suggested = true;
    }
  }
  await nextTick();
  document.querySelector(`[data-task="${row.taskId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function toNumber(text: string | number): number | null {
  const s = String(text ?? '').trim().replace(',', '.');
  return s === '' ? null : Number(s);
}

function yearsToDays(text: string | number): number | null {
  const years = toNumber(text);
  return years === null ? null : Math.round(years * YEAR);
}

async function toast(message: string) {
  const t = await toastController.create({ message, color: 'success', duration: 1500, position: 'top' });
  await t.present();
}

// ── Tarea propia ──
const draft = reactive({ label: '', emoji: CUSTOM_TASK_EMOJIS[0] as string, km: '', years: '', error: null as string | null });
const adding = ref(false);

async function addTask() {
  const km = toNumber(draft.km);
  const days = yearsToDays(draft.years);
  if ((km !== null && !(km > 0)) || (days !== null && !(days > 0))) {
    draft.error = 'Usa números mayores que 0';
    return;
  }
  const parsed = customTaskInputSchema.safeParse({
    label: String(draft.label ?? ''),
    emoji: draft.emoji,
    interval_km: km === null ? null : Math.round(km),
    interval_days: days,
  });
  if (!parsed.success) {
    draft.error = parsed.error.issues[0]?.message ?? 'Revisa los datos';
    return;
  }
  draft.error = null;
  adding.value = true;
  try {
    const task = await store.createCustomTask(props.id, parsed.data);
    planned.add(task.id);
    rows.push({ taskId: task.id, enabled: true, shown: true, km: draft.km, years: draft.years, suggested: false, open: false, error: null });
    Object.assign(draft, { label: '', km: '', years: '' });
    await toast(`${task.label}: añadida al plan`);
  } finally {
    adding.value = false;
  }
}

async function rename(row: Row) {
  const id = row.taskId as CustomTaskId;
  const alert = await alertController.create({
    header: 'Renombrar tarea',
    inputs: [{ name: 'label', type: 'text', value: taskLabel(id), attributes: { maxlength: 40 } }],
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Guardar', role: 'confirm' },
    ],
  });
  await alert.present();
  const { role, data } = await alert.onDidDismiss<{ values: { label: string } }>();
  const label = data?.values.label?.trim();
  if (role !== 'confirm' || !label) return;
  await store.renameCustomTask(id, label.slice(0, 40), taskEmoji(id));
}

async function removeTask(row: Row) {
  const id = row.taskId as CustomTaskId;
  const alert = await alertController.create({
    header: `¿Borrar «${taskLabel(id)}»?`,
    message: 'Saldrá del plan. Los registros donde la apuntaste se conservan.',
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Borrar', role: 'destructive' },
    ],
  });
  await alert.present();
  if ((await alert.onDidDismiss()).role !== 'destructive') return;
  await store.deleteCustomTask(id);
  rows.splice(rows.indexOf(row), 1);
  planned.delete(id);
}

async function save() {
  const changes: { taskId: TaskId; input: ScheduleInput }[] = [];
  let valid = true;

  for (const row of rows) {
    row.error = null;
    const parsed = scheduleInputSchema.safeParse({
      interval_km: toNumber(row.km),
      interval_days: yearsToDays(row.years),
      enabled: row.enabled,
    });
    if (!parsed.success) {
      row.error = 'Usa números mayores que 0';
      row.open = true;
      valid = false;
      continue;
    }
    if (parsed.data.enabled && !parsed.data.interval_km && !parsed.data.interval_days) {
      row.error = `Indica ${unit === 'km' ? 'km' : 'horas'}, años o ambos`;
      row.open = true;
      valid = false;
      continue;
    }
    if (!planned.has(row.taskId) && !parsed.data.enabled) continue;
    changes.push({ taskId: row.taskId, input: parsed.data });
  }
  if (!valid) {
    await nextTick();
    document.querySelector('.task .g-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  saving.value = true;
  try {
    await store.saveSchedules(props.id, changes);
    router.back();
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.intro {
  margin-top: 0;
  font-size: 14px;
}
.empty {
  font-size: 14px;
}
.task {
  margin-bottom: 8px;
  padding: 6px 12px 6px 6px;
}
.task.open {
  padding-bottom: 12px;
}
.task-summary {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-height: 44px;
  justify-content: center;
  padding: 2px 6px;
  border: none;
  border-radius: var(--g-radius-md);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.task-summary:hover {
  background: var(--g-surface-secondary);
}
.task-interval {
  font-family: var(--g-font-mono);
  font-size: 12px;
  color: var(--g-text-muted);
}
.chevron {
  flex: none;
  color: var(--g-text-muted);
  font-size: 16px;
}
.task .row,
.task .suggested,
.task .g-error {
  margin-left: 6px;
}
.custom-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}
.task.off {
  box-shadow: none;
  opacity: 0.6;
}
.task-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.task-label {
  font-weight: 600;
}
.row {
  display: flex;
  gap: 12px;
  margin-top: 10px;
}
.suggested {
  margin: 6px 0 0;
  font-size: 12px;
}

/* Catálogo plegable */
.catalog {
  margin-top: 28px;
}
.catalog-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  border: 1px dashed var(--g-border-strong);
  border-radius: var(--g-radius-lg);
  background: var(--g-surface);
  color: var(--g-text);
  font-family: var(--g-font-display);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}
.catalog-toggle ion-icon {
  font-size: 20px;
  color: var(--g-accent-text);
}
.catalog-count {
  margin-left: auto;
  font-family: var(--g-font-body);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}
.catalog-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 14px;
}
.catalog-title {
  margin: 0 0 8px;
  font-family: var(--g-font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--g-text-secondary);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--g-border);
  background: var(--g-surface);
  color: var(--g-text);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.chip ion-icon {
  color: var(--g-accent-text);
}
.chip:hover {
  border-color: var(--g-accent-text);
}

.new {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-style: dashed;
  box-shadow: none;
}
.new .row {
  margin-top: 0;
}
.emojis {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.emoji {
  width: 40px;
  height: 40px;
  border-radius: var(--g-radius-md);
  border: 1px solid var(--g-border);
  background: var(--g-surface);
  font-size: 20px;
  cursor: pointer;
}
.emoji.active {
  border-color: var(--g-accent-text);
  box-shadow: 0 0 0 2px var(--g-accent-text);
}
.add-custom {
  margin: 4px 0 0;
}
</style>

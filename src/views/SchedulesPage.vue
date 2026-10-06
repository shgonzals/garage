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
        Cada cuántos km o años toca cada tarea en <strong>{{ vehicle?.name }}</strong>. Lo que llegue antes manda.
        La ITV se calcula sola con la fecha de matriculación.
      </p>

      <div class="g-grid">
        <div v-for="row in builtinRows" :key="row.taskId" class="g-card task" :class="{ off: !row.enabled }">
          <div class="task-head">
            <span class="task-label">{{ taskEmoji(row.taskId) }} {{ taskLabel(row.taskId) }}</span>
            <ion-toggle v-model="row.enabled" :aria-label="`Activar ${taskLabel(row.taskId)}`" />
          </div>
          <div v-if="row.enabled" class="row">
            <ion-input v-model="row.km" label="Cada (km)" label-placement="stacked" fill="outline" type="number" inputmode="numeric" placeholder="—" :min="1" />
            <ion-input v-model="row.years" label="Cada (años)" label-placement="stacked" fill="outline" type="number" inputmode="decimal" placeholder="—" :min="0.5" step="0.5" />
          </div>
          <p v-if="row.error" class="g-error">{{ row.error }}</p>
        </div>
      </div>

      <!-- Tareas personalizadas -->
      <section class="g-section">
        <h3 class="g-section-title">Tus tareas</h3>
        <div class="g-grid">
          <div v-for="row in customRows" :key="row.taskId" class="g-card task" :class="{ off: !row.enabled }">
            <div class="task-head">
              <button type="button" class="task-label rename" :aria-label="`Renombrar ${taskLabel(row.taskId)}`" @click="rename(row)">
                {{ taskEmoji(row.taskId) }} {{ taskLabel(row.taskId) }}
                <ion-icon :icon="createOutline" aria-hidden="true" />
              </button>
              <div class="task-actions">
                <ion-button fill="clear" size="small" color="medium" :aria-label="`Borrar ${taskLabel(row.taskId)}`" @click="remove(row)">
                  <ion-icon slot="icon-only" :icon="trashOutline" />
                </ion-button>
                <ion-toggle v-model="row.enabled" :aria-label="`Activar ${taskLabel(row.taskId)}`" />
              </div>
            </div>
            <div v-if="row.enabled" class="row">
              <ion-input v-model="row.km" label="Cada (km)" label-placement="stacked" fill="outline" type="number" inputmode="numeric" placeholder="—" :min="1" />
              <ion-input v-model="row.years" label="Cada (años)" label-placement="stacked" fill="outline" type="number" inputmode="decimal" placeholder="—" :min="0.5" step="0.5" />
            </div>
            <p v-if="row.error" class="g-error">{{ row.error }}</p>
          </div>

          <!-- Nueva tarea: se crea al momento, sin esperar a "Guardar" -->
          <form class="g-card task new" @submit.prevent="addTask">
            <div class="task-label">Nueva tarea</div>
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
              <ion-input v-model="draft.km" label="Cada (km)" label-placement="stacked" fill="outline" type="number" inputmode="numeric" placeholder="—" :min="1" />
              <ion-input v-model="draft.years" label="Cada (años)" label-placement="stacked" fill="outline" type="number" inputmode="decimal" placeholder="—" :min="0.5" step="0.5" />
            </div>
            <p v-if="draft.error" class="g-error">{{ draft.error }}</p>
            <ion-button type="submit" expand="block" class="add" :disabled="adding">
              <ion-icon slot="start" :icon="add" />
              Añadir al plan
            </ion-button>
          </form>
        </div>
      </section>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
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
import { add, createOutline, trashOutline } from 'ionicons/icons';
import { customTaskInputSchema, scheduleInputSchema, type ScheduleInput } from '@/domain/schemas';
import { CUSTOM_TASK_EMOJIS, getTask, isCustomTaskId, TASKS, YEAR } from '@/domain/tasks';
import type { CustomTaskId, TaskId } from '@/domain/types';
import { useGarageStore } from '@/stores/garage';

const props = defineProps<{ id: string }>();
const store = useGarageStore();
const router = useIonRouter();
const saving = ref(false);

const vehicle = computed(() => store.vehicleById.get(props.id));
/** Tareas que ya tenían plan: las que no, si siguen desactivadas, no se guardan. */
const planned = new Set<TaskId>(store.schedules.filter((s) => s.vehicle_id === props.id).map((s) => s.task_id));
const current = new Map(store.schedules.filter((s) => s.vehicle_id === props.id).map((s) => [s.task_id, s]));

interface Row {
  taskId: TaskId;
  enabled: boolean;
  km: string;
  years: string;
  error: string | null;
}

/** 730 → "2"; 548 → "1.5". Redondeado a medio año. */
function daysToYears(days: number): string {
  return String(Math.round((days / YEAR) * 2) / 2);
}

function rowFor(taskId: TaskId): Row {
  const s = current.get(taskId);
  return {
    taskId,
    enabled: s?.enabled ?? false,
    km: s?.interval_km ? String(s.interval_km) : '',
    years: s?.interval_days ? daysToYears(s.interval_days) : '',
    error: null,
  };
}

const rows = reactive<Row[]>([
  // ITV, seguro e impuesto van por fecha, no por intervalo; "Otro" no se programa.
  ...TASKS.filter((t) => !['itv', 'insurance', 'road_tax', 'other'].includes(t.id))
    .map((t) => rowFor(t.id))
    // Activas primero, para que lo importante quede arriba.
    .sort((a, b) => Number(b.enabled) - Number(a.enabled)),
  ...store.customTasks.filter((t) => t.vehicle_id === props.id && !t.deleted_at).map((t) => rowFor(t.id)),
]);
const builtinRows = computed(() => rows.filter((r) => !isCustomTaskId(r.taskId)));
const customRows = computed(() => rows.filter((r) => isCustomTaskId(r.taskId)));

// Nombre e icono desde el store, que es reactivo: al renombrar se actualiza la tarjeta.
function taskLabel(id: TaskId): string {
  return store.customTasks.find((t) => t.id === id)?.label ?? getTask(id).label;
}
function taskEmoji(id: TaskId): string {
  return store.customTasks.find((t) => t.id === id)?.emoji ?? getTask(id).emoji;
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

// ── Nueva tarea ──
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
    rows.push({ taskId: task.id, enabled: true, km: draft.km, years: draft.years, error: null });
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

async function remove(row: Row) {
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
      valid = false;
      continue;
    }
    if (parsed.data.enabled && !parsed.data.interval_km && !parsed.data.interval_days) {
      row.error = 'Indica km, años o ambos';
      valid = false;
      continue;
    }
    if (!planned.has(row.taskId) && !parsed.data.enabled) continue;
    changes.push({ taskId: row.taskId, input: parsed.data });
  }
  if (!valid) return;

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
.task {
  margin-bottom: 10px;
  padding: 12px 16px;
}
.task.off {
  box-shadow: none;
  opacity: 0.75;
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
.rename {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.rename ion-icon {
  flex: none;
  color: var(--g-text-muted);
  font-size: 15px;
}
.task-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.row {
  display: flex;
  gap: 12px;
  margin-top: 10px;
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
.add {
  margin: 4px 0 0;
}
</style>

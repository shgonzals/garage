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
        <div v-for="row in rows" :key="row.taskId" class="g-card task" :class="{ off: !row.enabled }">
          <div class="task-head">
            <span class="task-label">{{ getTask(row.taskId).emoji }} {{ getTask(row.taskId).label }}</span>
            <ion-toggle v-model="row.enabled" :aria-label="`Activar ${getTask(row.taskId).label}`" />
          </div>
          <div v-if="row.enabled" class="row">
            <ion-input v-model="row.km" label="Cada (km)" label-placement="stacked" fill="outline" type="number" inputmode="numeric" placeholder="—" :min="1" />
            <ion-input v-model="row.years" label="Cada (años)" label-placement="stacked" fill="outline" type="number" inputmode="decimal" placeholder="—" :min="0.5" step="0.5" />
          </div>
          <p v-if="row.error" class="g-error">{{ row.error }}</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonPage,
  IonTitle,
  IonToggle,
  IonToolbar,
  useIonRouter,
} from '@ionic/vue';
import { scheduleInputSchema, type ScheduleInput } from '@/domain/schemas';
import { getTask, TASKS, YEAR } from '@/domain/tasks';
import type { TaskId } from '@/domain/types';
import { useGarageStore } from '@/stores/garage';

const props = defineProps<{ id: string }>();
const store = useGarageStore();
const router = useIonRouter();
const saving = ref(false);

const vehicle = computed(() => store.vehicleById.get(props.id));
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

const rows = reactive<Row[]>(
  TASKS.filter((t) => t.id !== 'itv' && t.id !== 'other')
    .map((t) => {
      const s = current.get(t.id);
      return {
        taskId: t.id,
        enabled: s?.enabled ?? false,
        km: s?.interval_km ? String(s.interval_km) : '',
        years: s?.interval_days ? daysToYears(s.interval_days) : '',
        error: null,
      };
    })
    // Activas primero, para que lo importante quede arriba.
    .sort((a, b) => Number(b.enabled) - Number(a.enabled)),
);

function toNumber(text: string | number): number | null {
  const s = String(text ?? '').trim().replace(',', '.');
  return s === '' ? null : Number(s);
}

function yearsToDays(text: string | number): number | null {
  const years = toNumber(text);
  return years === null ? null : Math.round(years * YEAR);
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
    // Las tareas que nunca tuvieron plan y siguen desactivadas no se guardan.
    if (!current.has(row.taskId) && !parsed.data.enabled) continue;
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
}
.task-label {
  font-weight: 600;
}
.row {
  display: flex;
  gap: 12px;
  margin-top: 10px;
}
</style>

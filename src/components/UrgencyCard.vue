<template>
  <div class="urgency" :class="tone">
    <RingGauge :fill="gauge.fill" :value="gauge.value" :unit="gauge.unit" :tone="tone" :size="58" />
    <div class="body">
      <h4>
        {{ task.label }}
        <span v-if="vehicleName" class="vehicle">· {{ vehicleName }}</span>
      </h4>
      <p class="headline">{{ reminderHeadline(reminder) }}</p>
      <p v-if="estimate" class="estimate">
        ≈ {{ $t('urgency.atYourPace', { date: formatDate(estimate), rate: formatRate(perDay, reminder.unit) }) }}
      </p>
      <p v-if="lastLine" class="last">{{ lastLine }}</p>
    </div>
    <!-- Acciones: solo donde la tarjeta no está dentro de otro botón (ficha del vehículo). -->
    <div v-if="actions && (canSnooze || eventDate)" class="actions">
      <button
        v-if="canSnooze"
        type="button"
        class="action"
        :aria-label="reminder.status === 'snoozed' ? $t('urgency.unsnoozeTask', { task: task.label }) : $t('urgency.snoozeTask', { task: task.label })"
        :title="reminder.status === 'snoozed' ? $t('urgency.unsnooze') : $t('urgency.snooze')"
        @click.stop="openSnooze"
      >
        <ion-icon :icon="alarmOutline" aria-hidden="true" />
      </button>
      <button
        v-if="eventDate"
        type="button"
        class="action"
        :aria-label="$t('urgency.calendarTask', { task: task.label })"
        :title="$t('urgency.calendar')"
        @click.stop="addToCalendar"
      >
        <ion-icon :icon="calendarOutline" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { actionSheetController, IonIcon, toastController } from '@ionic/vue';
import { alarmOutline, calendarOutline } from 'ionicons/icons';
import { t } from '@/i18n';
import { formatDate, formatRate, reminderGauge, reminderHeadline, reminderLastLine, snoozeUntilText } from '@/domain/format';
import { snoozeOptions } from '@/domain/snooze';
import type { Reminder } from '@/domain/reminders';
import { getTask } from '@/domain/tasks';
import { googleCalendarUrl } from '@/domain/calendar';
import { openExternal } from '@/lib/calendar';
import { useGarageStore } from '@/stores/garage';
import RingGauge from './RingGauge.vue';
import { STATUS_TONE } from './status';

/** `actions`: botones de posponer y de Google Calendar (solo donde la tarjeta no es ya un botón). */
const props = defineProps<{ reminder: Reminder; vehicleName?: string; actions?: boolean }>();

const task = computed(() => getTask(props.reminder.taskId));
const tone = computed(() => STATUS_TONE[props.reminder.status]);
const gauge = computed(() => reminderGauge(props.reminder));
const lastLine = computed(() => reminderLastLine(props.reminder));

const store = useGarageStore();
const estimate = computed(() => store.kmEstimate(props.reminder));
const perDay = computed(() => store.kmRates.get(props.reminder.vehicleId)?.perDay ?? 0);

/** Día del evento: la estimación a tu ritmo si adelanta a la fecha límite; si ya pasó, no hay nada que agendar. */
const eventDate = computed(() => {
  if (props.reminder.status === 'unknown' || props.reminder.status === 'snoozed') return null;
  const date = estimate.value ?? props.reminder.dueDate;
  return date && date >= store.today ? date : null;
});

/** Se puede posponer lo vencido o próximo, y quitar el aplazamiento de lo pospuesto. */
const canSnooze = computed(() => ['overdue', 'soon', 'snoozed'].includes(props.reminder.status));

async function openSnooze() {
  const r = props.reminder;
  if (r.status === 'snoozed') {
    const sheet = await actionSheetController.create({
      header: t('urgency.snoozedHeader', {
        task: task.value.label,
        until: r.snoozedUntil ? snoozeUntilText(r.snoozedUntil, r.unit) : '',
      }),
      buttons: [
        { text: t('urgency.unsnooze'), handler: () => void store.unsnooze(r.vehicleId, r.taskId) },
        { text: t('common.cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
    return;
  }
  const km = store.currentKm.get(r.vehicleId) ?? null;
  const sheet = await actionSheetController.create({
    header: t('urgency.snoozeHeader', { task: task.value.label.toLowerCase() }),
    subHeader: t('urgency.snoozeSub'),
    buttons: [
      ...snoozeOptions(r, km, store.today).map((o) => ({
        text: o.label,
        handler: () => {
          void store.snooze(r.vehicleId, r.taskId, o.until).then(async () => {
            const toast = await toastController.create({
              message: t('format.snoozed', { until: snoozeUntilText(o.until, r.unit) }),
              duration: 1800,
              position: 'top',
            });
            await toast.present();
          });
        },
      })),
      { text: t('common.cancel'), role: 'cancel' },
    ],
  });
  await sheet.present();
}

function addToCalendar() {
  if (!eventDate.value) return;
  const vehicle = store.vehicleById.get(props.reminder.vehicleId);
  openExternal(
    googleCalendarUrl({
      title: `${vehicle?.name ?? 'Garage'} · ${task.value.label}`,
      date: eventDate.value,
      details: `${reminderHeadline(props.reminder)}\n\n${t('urgency.createdWith')}`,
    }),
  );
}
</script>

<style scoped>
.urgency {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: var(--g-radius-lg);
  border: 1px solid var(--g-border);
  background: var(--g-surface);
  color: var(--g-text);
  margin-bottom: 10px;
}
.urgency.danger {
  border-color: var(--g-border-danger);
}
.urgency.warning {
  border-color: var(--g-border-warning);
}
.body {
  min-width: 0;
}
h4 {
  font-family: var(--g-font-display);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.15;
  margin: 0 0 3px;
}
.vehicle {
  font-weight: 600;
  color: var(--g-text-muted);
}
p {
  margin: 0;
}
.headline {
  font-size: 14px;
  line-height: 1.4;
  color: var(--g-text-secondary);
}
.danger .headline {
  color: var(--g-text-danger);
}
.warning .headline {
  color: var(--g-text-warning);
}
.estimate {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--g-accent-text);
}
.actions {
  flex: none;
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  margin: -6px -6px -6px auto;
}
.action {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--g-radius-md);
  background: none;
  color: var(--g-text-muted);
  font-size: 20px;
  cursor: pointer;
}
.action:hover {
  background: var(--g-surface-secondary);
  color: var(--g-accent-text);
}
.last {
  margin-top: 2px;
  font-family: var(--g-font-mono);
  font-size: 11px;
  text-transform: uppercase;
  color: var(--g-text-muted);
}
</style>

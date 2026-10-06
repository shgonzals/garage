<template>
  <div class="urgency" :class="tone">
    <RingGauge :fill="gauge.fill" :value="gauge.value" :unit="gauge.unit" :tone="tone" :size="58" />
    <div class="body">
      <h4>
        {{ task.label }}
        <span v-if="vehicleName" class="vehicle">· {{ vehicleName }}</span>
      </h4>
      <p class="headline">{{ reminderHeadline(reminder) }}</p>
      <p v-if="estimate" class="estimate">≈ {{ formatDate(estimate) }} a tu ritmo ({{ formatNumber(perDay) }} km/día)</p>
      <p v-if="lastLine" class="last">{{ lastLine }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatDate, formatNumber, reminderGauge, reminderHeadline, reminderLastLine } from '@/domain/format';
import type { Reminder } from '@/domain/reminders';
import { getTask } from '@/domain/tasks';
import { useGarageStore } from '@/stores/garage';
import RingGauge from './RingGauge.vue';
import { STATUS_TONE } from './status';

const props = defineProps<{ reminder: Reminder; vehicleName?: string }>();

const task = computed(() => getTask(props.reminder.taskId));
const tone = computed(() => STATUS_TONE[props.reminder.status]);
const gauge = computed(() => reminderGauge(props.reminder));
const lastLine = computed(() => reminderLastLine(props.reminder));

const store = useGarageStore();
const estimate = computed(() => store.kmEstimate(props.reminder));
const perDay = computed(() => Math.round(store.kmRates.get(props.reminder.vehicleId)?.perDay ?? 0));
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
.last {
  margin-top: 2px;
  font-family: var(--g-font-mono);
  font-size: 11px;
  text-transform: uppercase;
  color: var(--g-text-muted);
}
</style>

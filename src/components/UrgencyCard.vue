<template>
  <div class="urgency" :class="tone">
    <div class="dot" aria-hidden="true">{{ STATUS_DOT[reminder.status] }}</div>
    <div class="body">
      <h4>
        {{ task.label }}
        <span v-if="vehicleName" class="vehicle">· {{ vehicleName }}</span>
      </h4>
      <p>{{ reminderHeadline(reminder) }}</p>
      <p v-if="lastLine" class="last">{{ lastLine }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { reminderHeadline, reminderLastLine } from '@/domain/format';
import type { Reminder } from '@/domain/reminders';
import { getTask } from '@/domain/tasks';
import { STATUS_DOT, STATUS_TONE } from './status';

const props = defineProps<{ reminder: Reminder; vehicleName?: string }>();

const task = computed(() => getTask(props.reminder.taskId));
const tone = computed(() => STATUS_TONE[props.reminder.status]);
const lastLine = computed(() => reminderLastLine(props.reminder));
</script>

<style scoped>
.urgency {
  display: flex;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--g-radius-md);
  border: 1px solid;
  margin-bottom: 10px;
}
.dot {
  font-size: 16px;
  line-height: 1.4;
}
.body {
  min-width: 0;
}
h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px;
}
.vehicle {
  font-weight: 500;
  opacity: 0.8;
}
p {
  font-size: 13px;
  margin: 0 0 2px;
  line-height: 1.5;
}
.last {
  font-size: 11px;
  opacity: 0.85;
}
.danger {
  background: var(--g-bg-danger);
  border-color: var(--g-border-danger);
  color: var(--g-text-danger);
}
.warning {
  background: var(--g-bg-warning);
  border-color: var(--g-border-warning);
  color: var(--g-text-warning);
}
.success {
  background: var(--g-bg-success);
  border-color: var(--g-border-success);
  color: var(--g-text-success);
}
.neutral {
  background: var(--g-bg-neutral);
  border-color: var(--g-border-neutral);
  color: var(--g-text-neutral);
}
</style>

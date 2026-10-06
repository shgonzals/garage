<template>
  <button type="button" class="vehicle-card" :class="tone" @click="$emit('open')">
    <VehicleAvatar :photo="vehicle.photo" :type="vehicle.type" :size="48" />
    <div class="info">
      <div class="name">{{ vehicle.name }}</div>
      <div class="status">{{ summary ? summaryText(summary) : 'Sin recordatorios' }}</div>
    </div>
    <div class="km">
      <template v-if="km !== null">
        {{ formatNumber(km) }}
        <span>km</span>
      </template>
      <span v-else>— km</span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber, summaryText } from '@/domain/format';
import type { VehicleSummary } from '@/domain/reminders';
import type { Vehicle } from '@/domain/types';
import { STATUS_TONE } from './status';
import VehicleAvatar from './VehicleAvatar.vue';

const props = defineProps<{ vehicle: Vehicle; km: number | null; summary: VehicleSummary | undefined }>();
defineEmits<{ open: [] }>();

const tone = computed(() => STATUS_TONE[props.summary?.status ?? 'unknown']);
</script>

<style scoped>
.vehicle-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  font: inherit;
  color: var(--g-text);
  background: var(--g-surface);
  border: 1px solid var(--g-border);
  border-left: 4px solid var(--g-neutral);
  border-radius: var(--g-radius-lg);
  box-shadow: var(--g-shadow-md);
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: transform var(--g-transition), box-shadow var(--g-transition);
}
.vehicle-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--g-shadow-lg);
}
.vehicle-card:active {
  transform: scale(0.99);
}
.danger {
  border-left-color: var(--g-danger);
}
.warning {
  border-left-color: var(--g-warning);
}
.success {
  border-left-color: var(--g-success);
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 2px;
}
.status {
  font-size: 13px;
  color: var(--g-text-secondary);
}
.danger .status {
  color: var(--g-text-danger);
}
.warning .status {
  color: var(--g-text-warning);
}
.km {
  text-align: right;
  font-weight: 600;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.km span {
  display: block;
  font-size: 12px;
  font-weight: 400;
  color: var(--g-text-muted);
}
</style>

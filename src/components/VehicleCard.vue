<template>
  <button type="button" class="vehicle-card" :class="tone" @click="$emit('open')">
    <VehicleAvatar :photo="vehicle.photo" :type="vehicle.type" :size="48" />
    <div class="info">
      <div class="name">{{ vehicle.name }}</div>
      <div class="status">
        <!-- Testigo del cuadro: rojo vencido, ámbar pronto, verde al día; brilla si requiere atención. -->
        <span class="lamp" aria-hidden="true" />
        {{ summary ? summaryText(summary) : $t('format.noReminders') }}
      </div>
    </div>
    <div class="km">
      <template v-if="km !== null">
        {{ formatNumber(km) }}
        <span>{{ unit }}</span>
      </template>
      <span v-else>— {{ unit }}</span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber, summaryText } from '@/domain/format';
import type { VehicleSummary } from '@/domain/reminders';
import type { Vehicle } from '@/domain/types';
import { usageUnit } from '@/domain/units';
import { STATUS_TONE } from './status';
import VehicleAvatar from './VehicleAvatar.vue';

const props = defineProps<{ vehicle: Vehicle; km: number | null; summary: VehicleSummary | undefined }>();
const unit = computed(() => usageUnit(props.vehicle.type));
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
.vehicle-card.danger {
  border-color: var(--g-border-danger);
}
.vehicle-card.warning {
  border-color: var(--g-border-warning);
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-family: var(--g-font-display);
  font-weight: 700;
  font-size: 19px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.15;
  margin-bottom: 2px;
}
.status {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--g-text-secondary);
}
.lamp {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--g-border-strong);
}
.danger .lamp {
  background: var(--g-danger);
  box-shadow: 0 0 6px var(--g-danger);
}
.warning .lamp {
  background: var(--g-warning);
  box-shadow: 0 0 6px var(--g-warning);
}
.success .lamp {
  background: var(--g-success);
}
.danger .status {
  color: var(--g-text-danger);
}
.warning .status {
  color: var(--g-text-warning);
}
.km {
  font-family: var(--g-font-mono);
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

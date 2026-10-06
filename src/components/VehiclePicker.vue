<template>
  <div v-if="store.vehicles.length > 1" class="vehicle-picker" role="radiogroup" :aria-label="$t('common.vehicle')">
    <button
      v-for="v in store.vehicles"
      :key="v.id"
      type="button"
      role="radio"
      :aria-checked="v.id === modelValue"
      class="pick"
      :class="{ active: v.id === modelValue }"
      @click="$emit('update:modelValue', v.id)"
    >
      <VehicleAvatar :photo="v.photo" :type="v.type" :size="24" />
      {{ v.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useGarageStore } from '@/stores/garage';
import VehicleAvatar from './VehicleAvatar.vue';

/** Elegir vehículo con un toque (registro rápido, repostaje). Con un solo vehículo no se muestra. */
defineProps<{ modelValue: string }>();
defineEmits<{ 'update:modelValue': [id: string] }>();

const store = useGarageStore();
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
  background: var(--g-accent);
  border-color: var(--g-accent);
  color: var(--g-on-accent);
  box-shadow: var(--g-shadow-md);
}
</style>

<template>
  <span class="avatar" :style="{ '--size': `${size}px` }">
    <img v-if="photo" :src="photo" alt="" />
    <span v-else class="emoji" aria-hidden="true">{{ vehicleTypeEmoji(type) }}</span>
  </span>
</template>

<script setup lang="ts">
import { vehicleTypeEmoji } from '@/domain/tasks';
import type { VehicleType } from '@/domain/types';

/** Foto del vehículo en círculo; sin foto, el emoji de su tipo. */
withDefaults(defineProps<{ photo: string | null; type: VehicleType; size?: number }>(), { size: 44 });
</script>

<style scoped>
.avatar {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  overflow: hidden;
  background: var(--g-surface-secondary);
  border: 1px solid var(--g-border);
}
img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.emoji {
  font-size: calc(var(--size) * 0.55);
  line-height: 1;
}
</style>

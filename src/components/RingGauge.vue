<template>
  <span class="ring" :class="tone" :style="{ '--size': `${size}px` }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
      <circle :cx="c" :cy="c" :r="r" class="track" :stroke-width="stroke" fill="none" />
      <circle
        :cx="c"
        :cy="c"
        :r="r"
        class="fill"
        :stroke-width="stroke"
        fill="none"
        :stroke-dasharray="`${length * fill} ${length}`"
        :transform="`rotate(-90 ${c} ${c})`"
      />
    </svg>
    <span class="label">
      <span class="value">{{ value }}</span>
      <span v-if="unit" class="unit">{{ unit }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

/** Indicador circular del cuadro: `fill` 0–1 del intervalo consumido, color según el estado. */
const props = withDefaults(
  defineProps<{ fill: number; value: string; unit?: string; tone?: string; size?: number }>(),
  { unit: '', tone: 'neutral', size: 56 },
);

const stroke = computed(() => Math.round(props.size / 9));
const c = computed(() => props.size / 2);
const r = computed(() => (props.size - stroke.value) / 2);
const length = computed(() => 2 * Math.PI * r.value);
</script>

<style scoped>
.ring {
  position: relative;
  display: inline-grid;
  place-items: center;
  flex: none;
  width: var(--size);
  height: var(--size);
}
svg {
  position: absolute;
  inset: 0;
}
.track {
  stroke: var(--g-ring);
}
.fill {
  stroke: var(--g-text-muted);
  transition: stroke-dasharray 400ms ease;
}
.danger .fill {
  stroke: var(--g-danger);
}
.warning .fill {
  stroke: var(--g-warning);
}
.success .fill {
  stroke: var(--g-success);
}
.label {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.05;
}
.value {
  font-family: var(--g-font-mono);
  font-weight: 600;
  font-size: calc(var(--size) * 0.21);
  font-variant-numeric: tabular-nums;
}
.unit {
  font-family: var(--g-font-display);
  font-weight: 700;
  font-size: calc(var(--size) * 0.16);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.8;
}
</style>

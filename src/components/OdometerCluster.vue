<template>
  <div class="cluster" :class="tone">
    <svg class="arc" viewBox="0 0 360 210" aria-hidden="true">
      <path :d="ARC" class="arc-track" />
      <path v-if="fill > 0" :d="ARC" class="arc-fill" pathLength="1" :stroke-dasharray="`${fill} 1`" />
      <g class="ticks">
        <line v-for="(t, i) in TICKS" :key="i" :x1="t[0]" :y1="t[1]" :x2="t[2]" :y2="t[3]" />
      </g>
    </svg>

    <div class="center">
      <span class="caption">{{ unit === 'km' ? $t('cluster.odometer') : $t('units.h.title') }}</span>
      <button type="button" class="digits" :aria-label="$t('cluster.updateAria', { value: km ?? '—', unit })" @click="$emit('update')">
        <span v-for="(d, i) in digits" :key="i" class="digit" :class="{ lead: d.lead, last: i === digits.length - 1 }">
          {{ d.char }}
        </span>
        <span class="unit">{{ unit }}</span>
      </button>
      <span v-if="next" class="next">
        {{ next.status === 'overdue' ? $t('cluster.overdue') : $t('cluster.next') }} · <strong>{{ nextText }}</strong>
      </span>
      <span v-else class="next">{{ $t('cluster.nothingPlanned') }}</span>
      <button type="button" class="update" @click="$emit('update')">
        {{ unit === 'km' ? $t('cluster.updateKm') : $t('cluster.updateHours') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { nextServiceText, reminderGauge } from '@/domain/format';
import type { Reminder } from '@/domain/reminders';
import type { UsageUnit } from '@/domain/units';
import { STATUS_TONE } from './status';

/**
 * Cuadro de instrumentos de la ficha: odómetro de rodillos en el centro y un arco que se llena
 * a medida que se acerca el próximo mantenimiento (`next`, el recordatorio más urgente).
 */
/** `km`: el valor del odómetro, en la unidad del vehículo (`unit`: km u horas de motor). */
const props = withDefaults(defineProps<{ km: number | null; next: Reminder | null; unit?: UsageUnit }>(), { unit: 'km' });
defineEmits<{ update: [] }>();

// Semicírculo de radio 150 centrado en (180, 196); marcas cada 30°, de r=160 a r=172.
const ARC = 'M30 196 A150 150 0 0 1 330 196';
const TICKS: [number, number, number, number][] = [
  [20, 196, 8, 196],
  [41, 116, 31, 110],
  [100, 57, 94, 47],
  [180, 36, 180, 24],
  [260, 57, 266, 47],
  [319, 116, 329, 110],
  [340, 196, 352, 196],
];

const fill = computed(() => (props.next ? reminderGauge(props.next).fill : 0));
const nextText = computed(() => (props.next ? nextServiceText(props.next) : ''));
const tone = computed(() => (props.next ? STATUS_TONE[props.next.status] : 'neutral'));

/** Rodillos: mínimo 6, con los ceros de la izquierda atenuados como en un cuentakilómetros real. */
const digits = computed(() => {
  const text = props.km === null ? '------' : String(props.km).padStart(6, '0');
  const firstSignificant = text.search(/[1-9]/);
  return [...text].map((char, i) => ({ char, lead: props.km !== null && (firstSignificant === -1 ? i < text.length - 1 : i < firstSignificant) }));
});
</script>

<style scoped>
/* Siempre oscuro (también en modo claro): es un panel de instrumentos incrustado. */
.cluster {
  position: relative;
  display: flex;
  justify-content: center;
  height: 236px;
  border-radius: var(--g-radius-lg);
  background: var(--g-panel-bg);
  color: var(--g-panel-text);
  border: 1px solid var(--g-panel-line);
  overflow: hidden;
}
.arc {
  position: absolute;
  top: 14px;
  width: 360px;
  height: 210px;
}
.arc-track,
.arc-fill {
  fill: none;
  stroke-width: 12;
}
.arc-track {
  stroke: var(--g-panel-ring);
}
.arc-fill {
  stroke: var(--g-accent);
  transition: stroke-dasharray 500ms ease;
}
.danger .arc-fill {
  stroke: var(--g-danger);
}
.ticks line {
  stroke: var(--g-panel-line);
  stroke-width: 2;
}

.center {
  position: absolute;
  top: 84px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.caption {
  font-family: var(--g-font-display);
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--g-panel-muted);
}
.digits {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
}
.digit {
  display: grid;
  place-items: center;
  width: 28px;
  height: 40px;
  border-radius: 3px;
  border: 1px solid var(--g-panel-line);
  background: var(--g-digit-bg);
  font-family: var(--g-font-mono);
  font-weight: 600;
  font-size: 25px;
}
.digit.lead {
  color: var(--g-panel-muted);
  opacity: 0.6;
}
.digit.last {
  background: var(--g-accent);
  border-color: var(--g-accent);
  color: var(--g-on-accent);
}
.unit {
  margin-left: 6px;
  padding-bottom: 4px;
  font-family: var(--g-font-display);
  font-weight: 700;
  font-size: 17px;
  text-transform: uppercase;
  color: var(--g-panel-muted);
}
.next {
  max-width: 250px;
  text-align: center;
  font-family: var(--g-font-mono);
  font-size: 11px;
  text-transform: uppercase;
  color: var(--g-panel-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.next strong {
  font-weight: 600;
  color: var(--g-accent);
}
.danger .next strong {
  color: var(--g-danger);
}
.update {
  height: 34px;
  padding: 0 14px;
  border-radius: var(--g-radius-md);
  border: 1px solid var(--g-panel-line);
  background: none;
  color: var(--g-panel-text);
  font-family: var(--g-font-display);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}
.update:hover {
  border-color: var(--g-accent);
}
</style>

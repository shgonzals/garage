<template>
  <div ref="root" class="viz" @pointerleave="active = null">
    <ul class="legend">
      <li><span class="key maintenance" />{{ $t('stats.maintenance') }} <strong>{{ money(totals.maintenance) }}</strong></li>
      <li><span class="key fuel" />{{ $t('stats.fuel') }} <strong>{{ money(totals.fuel) }}</strong></li>
    </ul>
    <svg v-if="width > 0" :width="width" :height="HEIGHT" role="img" :aria-label="summary">
      <!-- Rejilla: 0, mitad y máximo -->
      <g class="grid">
        <template v-for="t in ticks" :key="t">
          <line :x1="AXIS" :x2="width" :y1="y(t)" :y2="y(t)" />
          <text :x="AXIS - 6" :y="y(t)" dy="0.32em" text-anchor="end">{{ compactEuros(t) }}</text>
        </template>
      </g>
      <g v-for="(m, i) in months" :key="m.month">
        <path v-for="seg in segments(m, i)" :key="seg.key" :d="seg.d" :class="seg.key" />
        <text class="month" :class="{ current: i === active }" :x="cx(i)" :y="HEIGHT - 6" text-anchor="middle">
          {{ monthInitial(i) }}
        </text>
        <!-- Zona de toque: toda la columna, más grande que la barra -->
        <rect
          class="hit"
          :x="cx(i) - band / 2"
          :y="0"
          :width="band"
          :height="HEIGHT"
          tabindex="0"
          :aria-label="`${monthName(i)}: ${money(m.maintenance + m.fuel)}`"
          @pointerenter="active = i"
          @pointerdown="active = i"
          @focus="active = i"
          @blur="active = null"
        />
      </g>
    </svg>

    <div v-if="active !== null && tip" class="tip" :style="{ left: `${tip.left}px` }" role="status">
      <div class="tip-title">{{ monthName(active) }}</div>
      <div class="tip-row"><span class="tip-value">{{ money(tip.maintenance) }}</span><span class="key maintenance" />{{ $t('stats.maintenance') }}</div>
      <div class="tip-row"><span class="tip-value">{{ money(tip.fuel) }}</span><span class="key fuel" />{{ $t('stats.fuel') }}</div>
      <div class="tip-total"><span class="tip-value">{{ money(tip.maintenance + tip.fuel) }}</span>{{ $t('stats.total') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { formatMoney, intlNumberLocale, monthName } from '@/domain/format';
import { t } from '@/i18n';
import type { MonthSpend } from '@/domain/stats';

/** Gasto mensual del año en columnas apiladas: mantenimiento (abajo) y combustible (arriba). */
const props = defineProps<{ months: MonthSpend[] }>();

const HEIGHT = 180;
const AXIS = 44; // ancho de las etiquetas del eje Y
const BOTTOM = 22; // iniciales de los meses
const TOP = 8;
const GAP = 2;
const TIP_WIDTH = 168; // hueco del color de la superficie entre segmentos
const monthInitial = (i: number) => monthName(i).charAt(0);

const root = ref<HTMLElement>();
const width = ref(0);
const active = ref<number | null>(null);
let observer: ResizeObserver | undefined;

onMounted(() => {
  observer = new ResizeObserver(([e]) => (width.value = Math.floor(e!.contentRect.width)));
  observer.observe(root.value!);
});
onBeforeUnmount(() => observer?.disconnect());

const money = (cents: number) => formatMoney(cents);
/** Marcas del eje: "500 €", "1000 €"; en compacto solo desde 10.000 € ("15 mil €", "€15K"). */
const compactEuros = (cents: number) =>
  new Intl.NumberFormat(intlNumberLocale(), {
    style: 'currency',
    currency: 'EUR',
    notation: cents >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: cents >= 1_000_000 ? 1 : 0,
  }).format(cents / 100);

/** Máximo "redondo" (1, 2, 2,5 o 5 × 10ⁿ €) para que las marcas del eje sean limpias. */
const max = computed(() => {
  const top = Math.max(...props.months.map((m) => m.maintenance + m.fuel), 1000);
  const mag = 10 ** Math.floor(Math.log10(top));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag >= top)!;
  return step * mag;
});
const ticks = computed(() => [0, max.value / 2, max.value]);

const band = computed(() => (width.value - AXIS) / 12);
const barWidth = computed(() => Math.min(24, band.value * 0.6));
const cx = (i: number) => AXIS + band.value * (i + 0.5);
const y = (cents: number) => TOP + (HEIGHT - TOP - BOTTOM) * (1 - cents / max.value);

/** Rectángulo con las esquinas de arriba redondeadas (solo el extremo del dato). */
function bar(x: number, top: number, bottom: number, rounded: boolean): string {
  const w = barWidth.value;
  const r = rounded ? Math.min(4, (bottom - top) / 2, w / 2) : 0;
  return `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${bottom} Z`;
}

function segments(m: MonthSpend, i: number) {
  const x = cx(i) - barWidth.value / 2;
  const base = y(0);
  const out: { key: string; d: string }[] = [];
  const mTop = y(m.maintenance);
  if (m.maintenance > 0) out.push({ key: 'maintenance', d: bar(x, mTop, base, m.fuel === 0) });
  if (m.fuel > 0) {
    const bottom = m.maintenance > 0 ? mTop - GAP : base;
    const top = Math.min(y(m.maintenance + m.fuel) - (m.maintenance > 0 ? GAP : 0), bottom - 1);
    out.push({ key: 'fuel', d: bar(x, top, bottom, true) });
  }
  return out;
}

const tip = computed(() => {
  if (active.value === null) return null;
  const m = props.months[active.value]!;
  // Al lado de la columna, no encima: a la derecha en la primera mitad, a la izquierda en la segunda.
  const x = cx(active.value);
  const right = x < (AXIS + width.value) / 2;
  const left = right ? x + barWidth.value / 2 + 8 : x - barWidth.value / 2 - 8 - TIP_WIDTH;
  return { ...m, left: Math.max(0, Math.min(width.value - TIP_WIDTH, left)) };
});

const totals = computed(() => ({
  maintenance: props.months.reduce((s, m) => s + m.maintenance, 0),
  fuel: props.months.reduce((s, m) => s + m.fuel, 0),
}));
const summary = computed(
  () => t('stats.chartSummary', { maintenance: money(totals.value.maintenance), fuel: money(totals.value.fuel) }),
);
</script>

<style scoped>
/* Colores de serie validados (CVD y contraste) contra todas las superficies de los temas. */
.viz {
  --viz-maintenance: #2a78d6;
  --viz-fuel: #eb6834;
  position: relative;
  width: 100%;
  min-height: 180px;
  touch-action: pan-y;
}
:global(.ion-palette-dark) .viz {
  --viz-maintenance: #3987e5;
  --viz-fuel: #d95926;
}
svg {
  display: block;
  overflow: visible;
}
.grid line {
  stroke: var(--g-border);
  stroke-width: 1;
}
.grid text,
.month {
  fill: var(--g-text-muted);
  font-family: var(--g-font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.month.current {
  fill: var(--g-text);
  font-weight: 700;
}
.maintenance {
  fill: var(--viz-maintenance);
}
.fuel {
  fill: var(--viz-fuel);
}
.hit {
  fill: transparent;
  cursor: pointer;
  outline: none;
}
.hit:focus-visible {
  stroke: var(--g-accent-text);
  stroke-width: 1;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--g-text-muted);
}
.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}
.legend strong {
  font-family: var(--g-font-mono);
  color: var(--g-text);
}
.tip {
  position: absolute;
  top: 34px;
  width: 168px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--g-surface);
  border: 1px solid var(--g-border-strong);
  box-shadow: var(--g-shadow-md);
  font-size: 12px;
  color: var(--g-text-secondary, var(--g-text));
  pointer-events: none;
}
.tip-title {
  font-weight: 600;
  color: var(--g-text);
  margin-bottom: 4px;
}
.tip-row,
.tip-total {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tip-total {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--g-border);
}
.tip-value {
  order: 3;
  margin-left: auto;
  font-family: var(--g-font-mono);
  font-weight: 700;
  color: var(--g-text);
}
.key {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.key.maintenance {
  background: var(--viz-maintenance);
}
.key.fuel {
  background: var(--viz-fuel);
}
</style>

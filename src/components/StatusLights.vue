<template>
  <div class="lights" role="list" :aria-label="$t('lights.summary')">
    <div v-for="l in lights" :key="l.tone" role="listitem" class="light" :class="[l.tone, { off: l.count === 0 }]">
      <span class="lamp" aria-hidden="true" />
      <span class="text">{{ $t(l.key, { n: l.count }, l.count) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Reminder } from '@/domain/reminders';

/** Testigos del cuadro: cuántas tareas vencidas, próximas y al día. Apagados si están a 0. */
const props = defineProps<{ reminders: Reminder[] }>();

const lights = computed(() => {
  const count = (s: Reminder['status']) => props.reminders.filter((r) => r.status === s).length;
  return [
    { tone: 'danger', count: count('overdue'), key: 'lights.overdue' },
    { tone: 'warning', count: count('soon'), key: 'lights.soon' },
    { tone: 'success', count: count('ok'), key: 'lights.ok' },
  ];
});
</script>

<style scoped>
.lights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.light {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 10px;
  border-radius: var(--g-radius-md);
  border: 1px solid var(--g-border);
  background: var(--g-surface);
}
.lamp {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--g-text-muted);
}
.text {
  font-family: var(--g-font-display);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.danger {
  background: var(--g-bg-danger);
  border-color: var(--g-border-danger);
  color: var(--g-text-danger);
}
.danger .lamp {
  background: var(--g-danger);
  box-shadow: 0 0 8px var(--g-danger);
}
.warning {
  background: var(--g-bg-warning);
  border-color: var(--g-border-warning);
  color: var(--g-text-warning);
}
.warning .lamp {
  background: var(--g-warning);
  box-shadow: 0 0 8px var(--g-warning);
}
.success {
  color: var(--g-text-success);
}
.success .lamp {
  background: var(--g-success);
}
/* Móviles estrechos (360 px): menos aire para que quepa "3 vencidos". */
@media (max-width: 400px) {
  .lights {
    gap: 6px;
  }
  .light {
    gap: 6px;
    padding: 0 7px;
  }
  .lamp {
    width: 8px;
    height: 8px;
  }
  .text {
    font-size: 14px;
    letter-spacing: 0.02em;
  }
}
/* Testigo apagado: sin color ni brillo. */
.light.off {
  background: var(--g-surface);
  border-color: var(--g-border);
  color: var(--g-text-muted);
}
.light.off .lamp {
  background: var(--g-border-strong);
  box-shadow: none;
}
</style>

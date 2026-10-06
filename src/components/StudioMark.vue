<template>
  <!-- Monograma de Orbita Labs (mismo dibujo que orbita-labs/brand/monograma-transparente.svg). -->
  <svg class="studio-mark" viewBox="0 0 100 100" :width="size" :height="size" aria-hidden="true">
    <mask :id="maskId" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <rect width="100" height="100" fill="#fff" />
      <!-- Hueco transparente alrededor de la luna: vale para cualquier fondo y tema. -->
      <circle cx="79.3" cy="20.7" r="21.1" fill="#000" />
    </mask>
    <circle cx="50" cy="50" r="41.4" fill="none" stroke="#8B5CF6" stroke-width="17.2" :mask="`url(#${maskId})`" />
    <circle cx="79.3" cy="20.7" r="14.9" fill="#EC4899" />
  </svg>
</template>

<script setup lang="ts">
import { useId } from 'vue';

/** Firma del estudio (colores de la marca Orbita Labs, no los del tema elegido). */
withDefaults(defineProps<{ size?: number }>(), { size: 16 });
const maskId = `studio-mark-${useId()}`;
</script>

<style scoped>
.studio-mark {
  flex: none;
  display: block;
}
</style>

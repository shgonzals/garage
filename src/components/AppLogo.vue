<template>
  <!-- Mismo dibujo que resources/logo/garage-icon.svg, recortado a la zona visible del icono. -->
  <svg class="app-logo" viewBox="18 18 72 72" :width="size" :height="size" role="img" aria-label="Garage">
    <rect x="18" y="18" width="72" height="72" rx="16" fill="#F5C518" />
    <path d="M73.9 37.3 A26 26 0 1 0 80 54" fill="none" stroke="#14171B" stroke-width="9" stroke-linecap="round" />
    <line x1="56" y1="54" x2="79" y2="54" stroke="#14171B" stroke-width="6" stroke-linecap="round" />
    <circle cx="54" cy="54" r="5.5" fill="#14171B" />
    <circle cx="54" cy="54" r="2.2" fill="#F5C518" />
  </svg>
</template>

<script setup lang="ts">
/** Logo de la app (los colores son los de la marca, no los del tema elegido). */
withDefaults(defineProps<{ size?: number }>(), { size: 28 });
</script>

<style scoped>
.app-logo {
  flex: none;
  display: block;
}
</style>

<template>
  <!-- Logo de Lichium Dev (la manzana pixelada de lichium.dev), con sus colores, no los del tema. -->
  <img class="studio-mark" :src="logo" alt="" :width="size" :height="size" />
</template>

<script setup lang="ts">
import logo from '@/assets/lichium.png';

/** Firma del estudio en el pie de Ajustes. */
withDefaults(defineProps<{ size?: number }>(), { size: 16 });
</script>

<style scoped>
.studio-mark {
  flex: none;
  display: block;
  /* Pixel art: sin suavizar al reducirlo. */
  image-rendering: pixelated;
}
</style>

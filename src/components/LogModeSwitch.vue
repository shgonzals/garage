<template>
  <ion-segment :value="mode" class="mode" aria-label="Qué vas a apuntar" @ion-change="go($event.detail.value)">
    <ion-segment-button value="maintenance">
      <ion-label>🔧 Mantenimiento</ion-label>
    </ion-segment-button>
    <ion-segment-button value="fuel">
      <ion-label>⛽ Repostaje</ion-label>
    </ion-segment-button>
  </ion-segment>
</template>

<script setup lang="ts">
import { IonLabel, IonSegment, IonSegmentButton, useIonRouter } from '@ionic/vue';

/** Cambia entre registro rápido y repostaje conservando el vehículo elegido. */
const props = defineProps<{ mode: 'maintenance' | 'fuel'; vehicleId: string }>();
const router = useIonRouter();

function go(value: unknown) {
  if (value === props.mode) return;
  const path = value === 'fuel' ? '/fuel' : '/log';
  router.replace(`${path}?vehicle=${props.vehicleId}`);
}
</script>

<style scoped>
.mode {
  margin-bottom: 16px;
}
</style>

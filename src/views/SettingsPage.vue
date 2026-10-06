<template>
  <ion-page class="g-narrow">
    <ion-header>
      <ion-toolbar>
        <ion-title>Ajustes</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Ajustes</ion-title>
        </ion-toolbar>
      </ion-header>

      <section class="g-section">
        <h3 class="g-section-title">Tema</h3>
        <div class="palettes" role="radiogroup" aria-label="Tema de color">
          <button
            v-for="p in PALETTES"
            :key="p.id"
            type="button"
            role="radio"
            class="palette"
            :class="{ active: palettePreference === p.id }"
            :aria-checked="palettePreference === p.id"
            @click="palettePreference = p.id"
          >
            <span class="swatch" :style="{ background: p.swatch[0] }" aria-hidden="true">
              <span class="swatch-accent" :style="{ background: p.swatch[1] }" />
            </span>
            {{ p.label }}
          </button>
        </div>
      </section>

      <section class="g-section">
        <h3 class="g-section-title">Modo</h3>
        <ion-segment v-model="themePreference" aria-label="Modo claro u oscuro">
          <ion-segment-button value="system">
            <ion-label>Sistema</ion-label>
          </ion-segment-button>
          <ion-segment-button value="light">
            <ion-label>☀️ Claro</ion-label>
          </ion-segment-button>
          <ion-segment-button value="dark">
            <ion-label>🌙 Oscuro</ion-label>
          </ion-segment-button>
        </ion-segment>
      </section>

      <section class="g-section">
        <h3 class="g-section-title">Datos</h3>
        <div class="g-card">
          <p class="g-secondary info">
            Todo se guarda en este dispositivo (SQLite). La sincronización en la nube llegará en la fase 0.3.
          </p>
          <ion-button expand="block" fill="outline" shape="round" :disabled="seeding" @click="seed">
            Cargar datos de ejemplo
          </ion-button>
        </div>
      </section>

      <p class="g-muted about">Garage v{{ version }} · Fase 0.1 (MVP local)</p>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  alertController,
  IonButton,
  IonContent,
  IonHeader,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue';
import { seedDemoData } from '@/db/demo';
import { useGarageStore } from '@/stores/garage';
import { palettePreference, PALETTES, themePreference } from '@/theme/theme';

const version = __APP_VERSION__;
const store = useGarageStore();
const seeding = ref(false);

async function seed() {
  const alert = await alertController.create({
    header: '¿Cargar datos de ejemplo?',
    message: 'Se añadirán 3 vehículos con historial (CBR600RR, Scrambler y Corolla).',
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Cargar', role: 'confirm' },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role !== 'confirm' || !store.repository) return;

  seeding.value = true;
  try {
    await seedDemoData(store.repository);
    await store.reload();
    const toast = await toastController.create({ message: 'Datos de ejemplo cargados', duration: 1500, position: 'top' });
    await toast.present();
  } finally {
    seeding.value = false;
  }
}
</script>

<style scoped>
.palettes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}
.palette {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 6px;
  border-radius: var(--g-radius-lg);
  border: 1px solid var(--g-border);
  background: var(--g-surface);
  color: var(--g-text);
  font-family: var(--g-font-display);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.palette.active {
  border-color: var(--g-accent-text);
  box-shadow: 0 0 0 2px var(--g-accent-text);
}
/* Muestra: fondo oscuro del tema con su acento, como un rodillo del odómetro. */
.swatch {
  position: relative;
  width: 100%;
  height: 40px;
  border-radius: var(--g-radius-md);
  overflow: hidden;
}
.swatch-accent {
  position: absolute;
  right: 8px;
  top: 8px;
  bottom: 8px;
  width: 18px;
  border-radius: 3px;
}
.info {
  margin-top: 0;
  font-size: 14px;
}
.about {
  text-align: center;
  font-size: 12px;
  margin-top: 32px;
}
</style>

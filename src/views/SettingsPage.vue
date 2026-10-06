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
            Todo se guarda solo en este dispositivo. Haz una copia de vez en cuando: si pierdes o cambias de móvil,
            la importas y lo recuperas todo.
          </p>
          <p class="last-backup g-mono">
            Última copia: {{ lastBackup ? formatDate(lastBackup) : 'nunca' }}
          </p>
          <div class="backup-actions">
            <ion-button expand="block" :disabled="busy" @click="exportData">Exportar copia</ion-button>
            <ion-button expand="block" fill="outline" :disabled="busy" @click="pickBackup">Importar copia</ion-button>
          </div>
          <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onBackupSelected" />
          <ion-button expand="block" fill="clear" size="small" class="demo" :disabled="busy" @click="seed">
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
import { formatDate } from '@/domain/format';
import { saveTextFile } from '@/lib/files';
import { useGarageStore } from '@/stores/garage';
import { palettePreference, PALETTES, themePreference } from '@/theme/theme';

const version = __APP_VERSION__;
const store = useGarageStore();
const busy = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

// Fecha de la última exportación en este dispositivo (solo informativa).
const LAST_BACKUP_KEY = 'garage-last-backup';
const lastBackup = ref<string | null>(readLastBackup());

function readLastBackup(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

async function toast(message: string, color?: string) {
  const t = await toastController.create({ message, color, duration: 2500, position: 'top' });
  await t.present();
}

async function exportData() {
  busy.value = true;
  try {
    const { name, json } = await store.exportBackup();
    if (!(await saveTextFile(name, json))) return;
    lastBackup.value = store.today;
    try {
      localStorage.setItem(LAST_BACKUP_KEY, store.today);
    } catch {
      // sin almacenamiento: solo no se recuerda la fecha
    }
    await toast('Copia exportada ✓', 'success');
  } catch {
    await toast('No se pudo exportar la copia', 'danger');
  } finally {
    busy.value = false;
  }
}

function pickBackup() {
  fileInput.value?.click();
}

async function onBackupSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // permite elegir el mismo archivo otra vez
  if (!file) return;

  const alert = await alertController.create({
    header: '¿Importar copia?',
    message: 'Se fusionará con lo que ya tienes: se añade lo que falte y, si algo está en los dos, se queda la versión más reciente. No se borra nada.',
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Importar', role: 'confirm' },
    ],
  });
  await alert.present();
  if ((await alert.onDidDismiss()).role !== 'confirm') return;

  busy.value = true;
  try {
    const result = await store.importBackup(await file.text());
    if (!result.ok) {
      await toast(result.error, 'danger');
      return;
    }
    const v = result.counts.vehicles;
    const e = result.counts.entries;
    await toast(
      `Copia del ${formatDate(result.exportedAt.slice(0, 10))} importada: ${v} ${v === 1 ? 'vehículo' : 'vehículos'}, ${e} ${e === 1 ? 'registro' : 'registros'}`,
      'success',
    );
  } catch {
    await toast('No se pudo importar la copia', 'danger');
  } finally {
    busy.value = false;
  }
}

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

  busy.value = true;
  try {
    await seedDemoData(store.repository);
    await store.reload();
    const toast = await toastController.create({ message: 'Datos de ejemplo cargados', duration: 1500, position: 'top' });
    await toast.present();
  } finally {
    busy.value = false;
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
.last-backup {
  margin: 0 0 12px;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--g-text-muted);
}
.backup-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.backup-actions ion-button {
  margin: 0;
}
.demo {
  margin-top: 8px;
}
.about {
  text-align: center;
  font-size: 12px;
  margin-top: 32px;
}
</style>

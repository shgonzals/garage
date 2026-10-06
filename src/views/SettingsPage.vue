<template>
  <ion-page class="g-narrow">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('nav.settings') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">{{ $t('nav.settings') }}</ion-title>
        </ion-toolbar>
      </ion-header>

      <section class="g-section">
        <h3 class="g-section-title">{{ $t('settings.language') }}</h3>
        <ion-segment v-model="languagePreference" :aria-label="$t('settings.language')">
          <ion-segment-button value="system">
            <ion-label>{{ $t('settings.system') }}</ion-label>
          </ion-segment-button>
          <ion-segment-button v-for="l in LANGUAGES" :key="l.id" :value="l.id">
            <ion-label>{{ l.label }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </section>

      <section class="g-section">
        <h3 class="g-section-title">{{ $t('settings.theme') }}</h3>
        <div class="palettes" role="radiogroup" :aria-label="$t('settings.themeAria')">
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
            {{ $t(`settings.palettes.${p.id}`) }}
          </button>
        </div>
      </section>

      <section class="g-section">
        <h3 class="g-section-title">{{ $t('settings.mode') }}</h3>
        <ion-segment v-model="themePreference" :aria-label="$t('settings.modeAria')">
          <ion-segment-button value="system">
            <ion-label>{{ $t('settings.system') }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="light">
            <ion-label>☀️ {{ $t('settings.light') }}</ion-label>
          </ion-segment-button>
          <ion-segment-button value="dark">
            <ion-label>🌙 {{ $t('settings.dark') }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </section>

      <section class="g-section">
        <h3 class="g-section-title">{{ $t('settings.alerts') }}</h3>
        <div class="g-card">
          <div v-if="alertsSupported" class="toggle-row">
            <div>
              <div class="toggle-label">{{ $t('settings.alertsToggle') }}</div>
              <div class="g-secondary small">{{ $t('settings.alertsHint') }}</div>
            </div>
            <ion-toggle
              :checked="alertsEnabled"
              :aria-label="$t('settings.alertsToggle')"
              @ion-change="toggleAlerts($event.detail.checked)"
            />
          </div>
          <ion-button
            v-if="alertsSupported && alertsEnabled && permission === 'prompt'"
            expand="block"
            class="allow"
            @click="allowAlerts"
          >
            {{ $t('settings.allowAlerts') }}
          </ion-button>
          <p v-if="alertsSupported && alertsEnabled && permission === 'denied'" class="denied">
            {{ $t('settings.alertsDenied') }}
          </p>
          <p v-if="!alertsSupported" class="g-secondary small">
            {{ $t('settings.alertsWeb') }}
          </p>

          <h4 class="upcoming-title">{{ $t('settings.upcoming') }}</h4>
          <ul v-if="upcoming.length > 0" class="upcoming">
            <li v-for="a in upcoming" :key="a.id">
              <span class="upcoming-at g-mono">{{ formatDayTime(a.at) }}</span>
              <span class="upcoming-text">
                <strong>{{ a.title }}</strong>
                <span>{{ a.body }}</span>
              </span>
            </li>
          </ul>
          <p v-else class="g-secondary small">{{ $t('settings.noUpcoming') }}</p>

          <ion-button v-if="alertsSupported && alertsEnabled" fill="clear" size="small" @click="testAlert">
            {{ $t('settings.testAlert') }}
          </ion-button>
        </div>
      </section>

      <section class="g-section">
        <h3 class="g-section-title">{{ $t('settings.data') }}</h3>
        <div class="g-card">
          <p class="g-secondary info">
            {{ $t('settings.dataInfo') }}
          </p>
          <p class="last-backup g-mono">
            {{ $t('settings.lastBackup', { date: lastBackup ? formatDate(lastBackup) : $t('settings.never') }) }}
          </p>
          <div class="backup-actions">
            <ion-button expand="block" :disabled="busy" @click="exportData">{{ $t('settings.export') }}</ion-button>
            <ion-button expand="block" fill="outline" :disabled="busy" @click="pickBackup">{{ $t('settings.import') }}</ion-button>
          </div>
          <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onBackupSelected" />
          <ion-button v-if="demoLoaded" expand="block" fill="clear" size="small" color="medium" class="demo" :disabled="busy" @click="unseed">
            {{ $t('settings.removeDemo') }}
          </ion-button>
          <ion-button v-else expand="block" fill="clear" size="small" class="demo" :disabled="busy" @click="seed">
            {{ $t('settings.loadDemo') }}
          </ion-button>
        </div>
      </section>

      <p class="g-muted about">Garage v{{ version }}</p>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
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
  IonToggle,
  IonToolbar,
  toastController,
} from '@ionic/vue';
import { isDemoVehicle, removeDemoData, seedDemoData } from '@/db/demo';
import { currentAlertPlan } from '@/composables/useAlertSync';
import { formatDate, formatDayTime } from '@/domain/format';
import { saveTextFile } from '@/lib/files';
import {
  alertPermission,
  alertsEnabled,
  alertsSupported,
  requestAlertPermission,
  sendTestAlert,
  type AlertPermission,
} from '@/lib/notifications';
import { useGarageStore } from '@/stores/garage';
import { languagePreference, LANGUAGES, t } from '@/i18n';
import { palettePreference, PALETTES, themePreference } from '@/theme/theme';

const version = __APP_VERSION__;
const store = useGarageStore();
const busy = ref(false);

// ── Avisos ──
const permission = ref<AlertPermission>('prompt');
onMounted(async () => {
  permission.value = await alertPermission();
});
/** Los 5 próximos avisos del plan actual (en web, vista previa de lo que llegaría en el móvil). */
const upcoming = computed(() => currentAlertPlan(store).slice(0, 5));

async function toggleAlerts(on: boolean) {
  alertsEnabled.value = on;
  if (on) permission.value = await requestAlertPermission();
}

async function allowAlerts() {
  permission.value = await requestAlertPermission();
}

async function testAlert() {
  if (permission.value !== 'granted') permission.value = await requestAlertPermission();
  if (permission.value !== 'granted') return;
  await sendTestAlert();
  await toast(t('settings.testSent'));
}
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
  const toastEl = await toastController.create({ message, color, duration: 2500, position: 'top' });
  await toastEl.present();
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
    await toast(t('settings.exported'), 'success');
  } catch {
    await toast(t('settings.exportFailed'), 'danger');
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
    header: t('settings.importHeader'),
    message: t('settings.importMessage'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      { text: t('settings.importButton'), role: 'confirm' },
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
      t('settings.imported', {
        date: formatDate(result.exportedAt.slice(0, 10)),
        vehicles: t('settings.vehiclesCount', { n: v }, v),
        entries: t('settings.entriesCount', { n: e }, e),
      }),
      'success',
    );
  } catch {
    await toast(t('settings.importFailed'), 'danger');
  } finally {
    busy.value = false;
  }
}

/** Hay vehículos de ejemplo: el botón pasa a quitarlos (y no se pueden cargar dos veces). */
const demoLoaded = computed(() => store.vehicles.some(isDemoVehicle));

async function unseed() {
  const alert = await alertController.create({
    header: t('settings.removeDemoHeader'),
    message: t('settings.removeDemoMessage'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      { text: t('settings.removeButton'), role: 'destructive' },
    ],
  });
  await alert.present();
  if ((await alert.onDidDismiss()).role !== 'destructive' || !store.repository) return;
  busy.value = true;
  try {
    await removeDemoData(store.repository);
    await store.reload();
    await toast(t('settings.demoRemoved'));
  } finally {
    busy.value = false;
  }
}

async function seed() {
  const alert = await alertController.create({
    header: t('settings.loadDemoHeader'),
    message: t('settings.loadDemoMessage'),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      { text: t('settings.loadButton'), role: 'confirm' },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role !== 'confirm' || !store.repository) return;

  busy.value = true;
  try {
    const added = await seedDemoData(store.repository);
    await store.reload();
    await toast(added ? t('settings.demoLoaded') : t('settings.demoAlready'));
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
.small {
  font-size: 13px;
  margin: 0;
}
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.toggle-label {
  font-weight: 600;
}
.allow {
  margin: 12px 0 0;
}
.denied {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: var(--g-radius-md);
  background: var(--g-bg-danger);
  color: var(--g-text-danger);
  font-size: 13px;
}
.upcoming-title {
  margin: 16px 0 6px;
  font-family: var(--g-font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--g-text-secondary);
}
.upcoming {
  list-style: none;
  margin: 0;
  padding: 0;
}
.upcoming li {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 10px;
  padding: 8px 0;
  border-top: 1px solid var(--g-border);
  font-size: 13px;
}
.upcoming-at {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--g-accent-text);
}
.upcoming-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.upcoming-text span {
  color: var(--g-text-secondary);
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

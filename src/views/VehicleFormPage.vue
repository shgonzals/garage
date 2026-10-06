<template>
  <ion-page class="g-narrow">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="id ? `/vehicles/${id}` : '/tabs/garage'" text="" />
        </ion-buttons>
        <ion-title>{{ id ? $t('vehicleForm.editTitle') : $t('vehicleForm.newTitle') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :strong="true" :disabled="saving" @click="save">{{ $t('common.save') }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form @submit.prevent="save">
        <!-- Foto de perfil (opcional) -->
        <div class="photo">
          <button type="button" class="photo-btn" :aria-label="form.photo ? $t('vehicleForm.changePhoto') : $t('vehicleForm.addPhoto')" @click="pickPhoto">
            <VehicleAvatar :photo="form.photo" :type="form.type" :size="104" />
            <span class="photo-badge" aria-hidden="true"><ion-icon :icon="camera" /></span>
          </button>
          <div class="photo-actions">
            <ion-button fill="clear" size="small" :disabled="processing" @click="pickPhoto">
              {{ processing ? $t('vehicleForm.processing') : form.photo ? $t('vehicleForm.changePhoto') : $t('vehicleForm.addPhoto') }}
            </ion-button>
            <ion-button v-if="form.photo" fill="clear" size="small" color="medium" @click="form.photo = null">
              {{ $t('settings.removeButton') }}
            </ion-button>
          </div>
          <p v-if="errors.photo" class="g-error">{{ errors.photo }}</p>
          <!-- Galería / archivos y, aparte, cámara directa (`capture`): en Android el selector no ofrece las dos. -->
          <input ref="fileInput" type="file" accept="image/*" hidden @change="onPhotoSelected" />
          <input ref="cameraInput" type="file" accept="image/*" capture="environment" hidden @change="onPhotoSelected" />
        </div>

        <h3 class="g-section-title">{{ $t('vehicleForm.type') }}</h3>
        <div class="types" role="radiogroup" :aria-label="$t('vehicleForm.typeAria')">
          <button
            v-for="t in VEHICLE_TYPES"
            :key="t.id"
            type="button"
            role="radio"
            class="type"
            :class="{ active: form.type === t.id }"
            :aria-checked="form.type === t.id"
            @click="form.type = t.id"
          >
            <span class="type-emoji" aria-hidden="true">{{ t.emoji }}</span>
            {{ t.label }}
          </button>
        </div>

        <div class="fields">
          <ion-input v-model="form.name" :label="$t('vehicleForm.name')" label-placement="stacked" fill="outline" :placeholder="examples.name" :maxlength="60" />
          <p v-if="errors.name" class="g-error">{{ errors.name }}</p>

          <div class="row">
            <ion-input v-model="form.make" :label="$t('vehicleForm.make')" label-placement="stacked" fill="outline" :placeholder="examples.make" />
            <ion-input v-model="form.model" :label="$t('vehicleForm.model')" label-placement="stacked" fill="outline" :placeholder="examples.model" />
          </div>

          <div class="row">
            <ion-input
              v-if="onRoad"
              v-model="form.plate"
              :label="$t('vehicleForm.plate')"
              label-placement="stacked"
              fill="outline"
              placeholder="1234ABC"
              autocapitalize="characters"
            />
            <ion-input
              v-model="kmText"
              :label="unitInfo(form.type).current"
              label-placement="stacked"
              fill="outline"
              type="number"
              inputmode="numeric"
              :min="0"
            />
          </div>
          <p v-if="errors.initial_km" class="g-error">{{ errors.initial_km }}</p>

          <ion-input
            v-if="onRoad"
            v-model="form.first_registration"
            :label="$t('vehicleForm.firstRegistration')"
            label-placement="stacked"
            fill="outline"
            type="date"
            :max="store.today"
            :helper-text="$t('vehicleForm.firstRegistrationHint')"
          />
          <p v-if="errors.first_registration" class="g-error">{{ errors.first_registration }}</p>
        </div>

        <!-- Vencimientos anuales (solo vehículos de carretera) -->
        <h3 v-if="onRoad" class="g-section-title deadlines-title">{{ $t('vehicleForm.deadlines') }}</h3>
        <div v-if="onRoad" class="fields">
          <div class="row">
            <ion-input
              v-model="form.insurance_due"
              :label="$t('vehicleForm.insuranceDue')"
              label-placement="stacked"
              fill="outline"
              type="date"
            />
            <ion-input
              v-model="form.road_tax_due"
              :label="$t('vehicleForm.roadTaxDue')"
              label-placement="stacked"
              fill="outline"
              type="date"
            />
          </div>
          <p v-if="errors.insurance_due || errors.road_tax_due" class="g-error">
            {{ errors.insurance_due || errors.road_tax_due }}
          </p>
          <p class="g-secondary hint">
            {{ $t('vehicleForm.deadlinesHint') }}
          </p>
        </div>

        <ion-button type="submit" expand="block" shape="round" size="large" class="save" :disabled="saving">
          {{ id ? $t('common.saveChanges') : $t('vehicleForm.addToGarage') }}
        </ion-button>

        <ion-button v-if="id" expand="block" fill="clear" color="danger" class="delete" @click="remove">
          {{ $t('vehicleForm.delete') }}
        </ion-button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import {
  actionSheetController,
  alertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/vue';
import { camera, imagesOutline } from 'ionicons/icons';
import VehicleAvatar from '@/components/VehicleAvatar.vue';
import { fieldErrors, vehicleInputSchema } from '@/domain/schemas';
import { isRoadVehicle, VEHICLE_TYPES } from '@/domain/tasks';
import { unitInfo } from '@/domain/units';
import type { VehicleType } from '@/domain/types';
import { toSquareThumbnail } from '@/lib/image';
import { useGarageStore } from '@/stores/garage';
import { t as tr } from '@/i18n';

const props = defineProps<{ id?: string }>();
const store = useGarageStore();
const router = useIonRouter();

const existing = props.id ? store.vehicleById.get(props.id) : undefined;
const existingKm = props.id ? store.currentKm.get(props.id) : undefined;

const form = reactive({
  name: existing?.name ?? '',
  type: (existing?.type ?? 'motorcycle') as VehicleType,
  make: existing?.make ?? '',
  model: existing?.model ?? '',
  plate: existing?.plate ?? '',
  first_registration: existing?.first_registration ?? '',
  insurance_due: existing?.insurance_due ?? '',
  road_tax_due: existing?.road_tax_due ?? '',
  photo: existing?.photo ?? null,
});
/** Kart y pit bike no circulan por vía pública: sin matrícula, ITV ni vencimientos. */
const onRoad = computed(() => isRoadVehicle(form.type));

/** Ejemplos en los campos, según el tipo elegido. */
const EXAMPLES: Record<VehicleType, { name: string; make: string; model: string }> = {
  motorcycle: { name: 'CBR600RR', make: 'Honda', model: 'CBR600RR' },
  moped: { name: 'Vespino', make: 'Piaggio', model: 'Zip 50' },
  car: { name: 'Corolla', make: 'Toyota', model: 'Corolla Hybrid' },
  van: { name: 'Furgo', make: 'Renault', model: 'Kangoo' },
  pitbike: { name: 'Pit bike', make: 'IMR', model: 'CRZ 140' },
  kart: { name: 'Kart', make: 'Tony Kart', model: 'Racer 401' },
};
const examples = computed(() => EXAMPLES[form.type]);

const kmText = ref(existingKm !== undefined ? String(existingKm) : '');
const errors = ref<Record<string, string>>({});
const saving = ref(false);
const processing = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const cameraInput = ref<HTMLInputElement | null>(null);

async function pickPhoto() {
  // En la web el navegador ya ofrece sus opciones; en la app nativa preguntamos nosotros.
  if (!Capacitor.isNativePlatform()) {
    fileInput.value?.click();
    return;
  }
  const sheet = await actionSheetController.create({
    header: tr('vehicleForm.photoHeader'),
    buttons: [
      { text: tr('vehicleForm.takePhoto'), icon: camera, handler: () => cameraInput.value?.click() },
      { text: tr('vehicleForm.fromGallery'), icon: imagesOutline, handler: () => fileInput.value?.click() },
      { text: tr('common.cancel'), role: 'cancel' },
    ],
  });
  await sheet.present();
}

async function onPhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // permite volver a elegir el mismo archivo
  if (!file) return;
  processing.value = true;
  try {
    form.photo = await toSquareThumbnail(file);
    delete errors.value.photo;
  } catch {
    errors.value = { ...errors.value, photo: tr('vehicleForm.photoError') };
  } finally {
    processing.value = false;
  }
}

async function save() {
  const km = String(kmText.value ?? '').trim();
  const parsed = vehicleInputSchema.safeParse({
    ...form,
    plate: onRoad.value ? form.plate : '',
    first_registration: (onRoad.value && form.first_registration) || null,
    insurance_due: (onRoad.value && form.insurance_due) || null,
    road_tax_due: (onRoad.value && form.road_tax_due) || null,
    initial_km: km === '' ? null : Number(km),
  });
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error);
    return;
  }
  if (existingKm !== undefined && parsed.data.initial_km !== null && parsed.data.initial_km < existingKm) {
    errors.value = { initial_km: tr('vehicleForm.kmDown') };
    return;
  }
  errors.value = {};
  saving.value = true;
  try {
    if (props.id) {
      await store.updateVehicle(props.id, parsed.data);
      router.back();
    } else {
      const v = await store.createVehicle(parsed.data);
      router.replace(`/vehicles/${v.id}`);
    }
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!props.id) return;
  const alert = await alertController.create({
    header: tr('vehicleForm.deleteHeader', { name: existing?.name ?? tr('common.vehicle') }),
    message: tr('vehicleForm.deleteMessage'),
    buttons: [
      { text: tr('common.cancel'), role: 'cancel' },
      { text: tr('common.remove'), role: 'destructive' },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role !== 'destructive') return;
  await store.deleteVehicle(props.id);
  router.navigate('/tabs/garage', 'root', 'replace');
}
</script>

<style scoped>
.photo {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}
.photo-btn {
  position: relative;
  padding: 0;
  border: none;
  background: none;
  border-radius: 50%;
  cursor: pointer;
}
.photo-btn:focus-visible {
  outline: 3px solid rgba(var(--g-accent-rgb), 0.5);
  outline-offset: 3px;
}
.photo-badge {
  position: absolute;
  right: 2px;
  bottom: 2px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--g-accent);
  color: var(--g-on-accent);
  font-size: 16px;
  border: 3px solid var(--g-bg);
}
.photo-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
.types {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 24px;
}
.type {
  display: flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  padding: 12px;
  border-radius: var(--g-radius-md);
  border: 1px solid var(--g-border);
  background: var(--g-surface);
  color: var(--g-text);
  cursor: pointer;
  transition: all var(--g-transition);
}
.type.active {
  border-color: var(--g-accent-text);
  box-shadow: 0 0 0 2px var(--g-accent-text);
}
.type-emoji {
  font-size: 22px;
}
.fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row {
  display: flex;
  gap: 12px;
}
.deadlines-title {
  margin-top: 24px;
}
.hint {
  margin: 0;
  font-size: 13px;
}
.save {
  margin-top: 28px;
}
.delete {
  margin-top: 8px;
}
@media (min-width: 992px) {
  .types {
    grid-template-columns: repeat(3, 1fr);
  }
  .type {
    flex-direction: column;
    padding: 16px 12px;
  }
  .type-emoji {
    font-size: 28px;
  }
}
</style>

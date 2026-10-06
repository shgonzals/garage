<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Mi garage</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/vehicles/new" aria-label="Añadir vehículo">
            <ion-icon slot="icon-only" :icon="addCircle" color="primary" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Mi garage</ion-title>
        </ion-toolbar>
      </ion-header>

      <div v-if="store.vehicles.length === 0" class="g-empty">
        <div class="g-empty-emoji">🏍️</div>
        <h2>Tu garage está vacío</h2>
        <p>Añade tu moto o tu coche y te diremos qué toca y cuándo.</p>
        <ion-button router-link="/vehicles/new" shape="round">Añadir vehículo</ion-button>
      </div>

      <div v-else class="g-grid">
        <VehicleCard
          v-for="v in store.vehicles"
          :key="v.id"
          :vehicle="v"
          :km="store.currentKm.get(v.id) ?? null"
          :summary="store.summaries.get(v.id)"
          @open="router.push(`/vehicles/${v.id}`)"
        />
      </div>

      <ion-fab v-if="store.vehicles.length > 0" slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button router-link="/log" aria-label="Registrar mantenimiento">
          <ion-icon :icon="flash" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/vue';
import { addCircle, flash } from 'ionicons/icons';
import VehicleCard from '@/components/VehicleCard.vue';
import { useGarageStore } from '@/stores/garage';

const store = useGarageStore();
const router = useIonRouter();
</script>

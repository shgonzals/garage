<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="garage" href="/tabs/garage">
          <ion-icon :icon="carSportOutline" aria-hidden="true" />
          <ion-label>{{ $t('nav.garageTab') }}</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="reminders" href="/tabs/reminders">
          <ion-icon :icon="alarmOutline" aria-hidden="true" />
          <ion-label>{{ $t('nav.reminders') }}</ion-label>
          <ion-badge v-if="overdueCount > 0" color="danger">{{ overdueCount }}</ion-badge>
        </ion-tab-button>
        <ion-tab-button tab="stats" href="/tabs/stats">
          <ion-icon :icon="walletOutline" aria-hidden="true" />
          <ion-label>{{ $t('nav.stats') }}</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="settings" href="/tabs/settings">
          <ion-icon :icon="settingsOutline" aria-hidden="true" />
          <ion-label>{{ $t('nav.settings') }}</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonBadge, IonIcon, IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue';
import { alarmOutline, carSportOutline, settingsOutline, walletOutline } from 'ionicons/icons';
import { useGarageStore } from '@/stores/garage';

const store = useGarageStore();
const overdueCount = computed(() => store.allReminders.filter((r) => r.status === 'overdue').length);
</script>

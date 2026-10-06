<template>
  <ion-app>
    <!-- En escritorio, menú lateral fijo (contraíble); en móvil se navega con las pestañas de abajo. -->
    <ion-split-pane content-id="main" when="lg" :class="{ 'side-collapsed': sidebarCollapsed }">
      <SideMenu />
      <ion-router-outlet id="main" />
    </ion-split-pane>
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet, IonSplitPane } from '@ionic/vue';
import SideMenu from '@/components/SideMenu.vue';
import { useAlertSync } from '@/composables/useAlertSync';
import { sidebarCollapsed } from '@/composables/useSidebar';

useAlertSync();
</script>

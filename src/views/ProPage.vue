<template>
  <ion-page class="g-narrow">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/settings" text="" />
        </ion-buttons>
        <ion-title>Garage Pro</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="hero">
        <AppLogo :size="72" />
        <h1>Garage <span class="pro">Pro</span></h1>
        <p v-if="isPro" class="lead">{{ $t('pro.thanks') }}</p>
        <p v-else-if="reason" class="lead">{{ $t(`pro.reason.${reason}`) }}</p>
        <p v-else class="lead">{{ $t('pro.lead') }}</p>
      </div>

      <ul class="benefits">
        <li v-for="b in BENEFITS" :key="b.key" class="g-card benefit" :class="{ highlight: b.key === reason }">
          <span class="benefit-icon" aria-hidden="true">{{ b.emoji }}</span>
          <span>
            <strong>{{ $t(`pro.benefits.${b.key}.title`) }}</strong>
            <span class="g-secondary">{{ $t(`pro.benefits.${b.key}.text`, { n: FREE_VEHICLES }) }}</span>
          </span>
          <ion-icon v-if="isPro" class="check" :icon="checkmarkCircle" aria-hidden="true" />
        </li>
      </ul>

      <template v-if="!isPro">
        <ion-button expand="block" shape="round" size="large" class="buy" :disabled="busy || !canBuy" @click="buy">
          {{ $t('pro.buy', { price: price ?? formatMoney(199) }) }}
        </ion-button>
        <p class="g-secondary small center">{{ $t('pro.oneTime') }}</p>
        <ion-button v-if="billingSupported" expand="block" fill="clear" size="small" :disabled="busy" @click="restore">
          {{ $t('pro.restore') }}
        </ion-button>
        <p v-if="!canBuy" class="g-secondary small center">{{ $t('pro.androidOnly') }}</p>
        <p v-if="devUnlock" class="g-muted small center">{{ $t('pro.devNote') }}</p>
      </template>
      <ion-button v-else-if="devUnlock" expand="block" fill="clear" size="small" color="medium" @click="setPro(false)">
        {{ $t('pro.devReset') }}
      </ion-button>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  toastController,
  useIonRouter,
} from '@ionic/vue';
import { checkmarkCircle } from 'ionicons/icons';
import AppLogo from '@/components/AppLogo.vue';
import { formatMoney } from '@/domain/format';
import { t } from '@/i18n';
import { billingSupported, buyPro, devUnlock, FREE_VEHICLES, isPro, proPrice, refreshPro, setPro } from '@/lib/pro';

const BENEFITS = [
  { key: 'stats', emoji: '💶' },
  { key: 'vehicles', emoji: '🏍️' },
  { key: 'themes', emoji: '🎨' },
  { key: 'widget', emoji: '📱' },
] as const;
type Reason = (typeof BENEFITS)[number]['key'];

const route = useRoute();
const router = useIonRouter();
/** Desde dónde se llegó (`/pro?from=vehicles`): se destaca esa ventaja. */
const reason = computed<Reason | null>(() => {
  const from = route.query.from;
  return BENEFITS.some((b) => b.key === from) ? (from as Reason) : null;
});

const price = ref<string | null>(null);
const busy = ref(false);
const canBuy = billingSupported || devUnlock;

onMounted(async () => {
  price.value = await proPrice();
});

async function toast(message: string, color = 'success') {
  const el = await toastController.create({ message, color, duration: 2500, position: 'top' });
  await el.present();
}

async function buy() {
  busy.value = true;
  try {
    const result = await buyPro();
    if (result === 'purchased') {
      await toast(t('pro.purchased'));
      if (router.canGoBack()) router.back();
    } else if (result === 'pending') await toast(t('pro.pending'), 'warning');
    else if (result === 'error') await toast(t('pro.error'), 'danger');
  } finally {
    busy.value = false;
  }
}

async function restore() {
  busy.value = true;
  try {
    const owned = await refreshPro();
    if (owned === null) await toast(t('pro.unavailable'), 'danger');
    else await toast(owned ? t('pro.restored') : t('pro.notFound'), owned ? 'success' : 'medium');
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin: 8px 0 20px;
}
.hero h1 {
  margin: 12px 0 4px;
  font-family: var(--g-font-display, inherit);
  font-size: 30px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.pro {
  color: var(--g-accent-text);
}
.lead {
  margin: 0;
  color: var(--g-text-secondary);
  max-width: 34ch;
}
.benefits {
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
  display: grid;
  gap: 10px;
}
.benefit {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
}
.benefit.highlight {
  border-color: var(--g-accent);
  box-shadow: 0 0 0 1px var(--g-accent);
}
.benefit > span:nth-child(2) {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 14px;
}
.benefit-icon {
  font-size: 26px;
}
.check {
  font-size: 22px;
  color: var(--ion-color-success);
}
.buy {
  margin-top: 4px;
}
.small {
  font-size: 13px;
}
.center {
  text-align: center;
  margin: 8px 0;
}
</style>

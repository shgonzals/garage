import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { IonicVue } from '@ionic/vue';

import App from './App.vue';
import router from './router';
import { openCapacitorDatabase } from './db/capacitor';
import { migrate } from './db/migrations';
import { GarageRepository } from './db/repository';
import { useGarageStore } from './stores/garage';
import { i18n, initLanguage, t } from './i18n';
import { initTheme } from './theme/theme';

/* Ionic: CSS básico + utilidades */
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';
import '@ionic/vue/css/palettes/dark.class.css';

/* Tipografías locales: la app funciona sin conexión */
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';

import './theme/palettes.css';
import './theme/variables.css';

async function bootstrap() {
  initTheme();
  initLanguage();

  const pinia = createPinia();
  const app = createApp(App).use(IonicVue, { mode: 'ios' }).use(pinia).use(router).use(i18n);

  const db = await openCapacitorDatabase();
  await migrate(db);
  await useGarageStore(pinia).init(new GarageRepository(db));

  await router.isReady();
  app.mount('#app');
}

bootstrap().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="padding:16px;white-space:pre-wrap;color:#dc2626">${t('app.dbError')}\n${String(err)}</pre>`;
});

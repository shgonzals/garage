import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { IonicVue } from '@ionic/vue';

import App from './App.vue';
import router from './router';
import { openCapacitorDatabase } from './db/capacitor';
import { migrate } from './db/migrations';
import { GarageRepository } from './db/repository';
import { useGarageStore } from './stores/garage';
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
import './theme/variables.css';

async function bootstrap() {
  initTheme();

  const pinia = createPinia();
  const app = createApp(App).use(IonicVue, { mode: 'ios' }).use(pinia).use(router);

  const db = await openCapacitorDatabase();
  await migrate(db);
  await useGarageStore(pinia).init(new GarageRepository(db));

  await router.isReady();
  app.mount('#app');
}

bootstrap().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="padding:16px;white-space:pre-wrap;color:#dc2626">No se pudo abrir la base de datos:\n${String(err)}</pre>`;
});

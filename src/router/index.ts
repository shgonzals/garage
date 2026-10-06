import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import TabsPage from '@/views/TabsPage.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/tabs/garage' },
  {
    path: '/tabs/',
    component: TabsPage,
    children: [
      { path: '', redirect: '/tabs/garage' },
      { path: 'garage', component: () => import('@/views/GaragePage.vue') },
      { path: 'reminders', component: () => import('@/views/RemindersPage.vue') },
      { path: 'settings', component: () => import('@/views/SettingsPage.vue') },
    ],
  },
  { path: '/vehicles/new', component: () => import('@/views/VehicleFormPage.vue') },
  { path: '/vehicles/:id', component: () => import('@/views/VehicleDetailPage.vue'), props: true },
  { path: '/vehicles/:id/edit', component: () => import('@/views/VehicleFormPage.vue'), props: true },
  { path: '/vehicles/:id/plan', component: () => import('@/views/SchedulesPage.vue'), props: true },
  { path: '/vehicles/:id/km', component: () => import('@/views/OdometerPage.vue'), props: true },
  { path: '/log', component: () => import('@/views/QuickLogPage.vue') },
  { path: '/entries/:entryId/edit', component: () => import('@/views/QuickLogPage.vue'), props: true },
  { path: '/:pathMatch(.*)*', redirect: '/tabs/garage' },
];

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

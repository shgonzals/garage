<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('nav.stats') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">{{ $t('nav.stats') }}</ion-title>
        </ion-toolbar>
      </ion-header>

      <div v-if="store.vehicles.length === 0" class="g-empty">
        <div class="g-empty-emoji">💶</div>
        <h2>{{ $t('statsPage.emptyTitle') }}</h2>
        <p>{{ $t('statsPage.emptyText') }}</p>
      </div>

      <template v-else>
        <!-- Filtros en una sola fila: vehículo y año -->
        <div class="filters">
          <ion-segment v-if="store.vehicles.length > 1" v-model="filter" :scrollable="true" class="filter">
            <ion-segment-button value="all">
              <ion-label>{{ $t('common.all') }}</ion-label>
            </ion-segment-button>
            <ion-segment-button v-for="v in store.vehicles" :key="v.id" :value="v.id">
              <ion-label>{{ v.name }}</ion-label>
            </ion-segment-button>
          </ion-segment>
          <div class="year" role="group" :aria-label="$t('statsPage.year')">
            <ion-button fill="clear" size="small" :disabled="!olderYear" :aria-label="$t('statsPage.prevYear')" @click="year = olderYear!">
              <ion-icon slot="icon-only" :icon="chevronBack" />
            </ion-button>
            <span class="year-value g-mono">{{ year }}</span>
            <ion-button fill="clear" size="small" :disabled="!newerYear" :aria-label="$t('statsPage.nextYear')" @click="year = newerYear!">
              <ion-icon slot="icon-only" :icon="chevronForward" />
            </ion-button>
          </div>
        </div>

        <!-- La cifra del año -->
        <section class="hero">
          <div class="hero-label">{{ $t('statsPage.spentIn', { year }) }}</div>
          <div class="hero-value">{{ formatMoney(totals.total) }}</div>
          <div v-if="perMonth" class="g-secondary hero-sub">{{ $t('statsPage.perMonth', { amount: perMonth }) }}</div>
        </section>

        <section class="g-card chart-card">
          <SpendingChart v-if="totals.total > 0" :months="months" />
          <p v-else class="g-secondary no-data">
            {{ $t('statsPage.noData', { year }) }}
          </p>
        </section>

        <!-- Un vehículo: sus cifras -->
        <section v-if="selected" class="g-section">
          <h3 class="g-section-title">{{ $t('statsPage.vehicleIn', { name: selected.vehicle.name, year }) }}</h3>
          <div class="kpis">
            <div class="kpi">
              <div class="kpi-label">{{ selected.unit === 'km' ? $t('statsPage.costPerKm') : $t('statsPage.costPerHour') }}</div>
              <div class="kpi-value">{{ costPerUnit(selected.stats, selected.unit) }}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">{{ $t('statsPage.consumption') }}</div>
              <div class="kpi-value">{{ consumption(selected.stats, selected.unit) }}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">{{ selected.unit === 'km' ? $t('statsPage.distance') : $t('statsPage.hoursUsed') }}</div>
              <div class="kpi-value">
                {{ selected.stats.distance !== null ? formatUsage(selected.stats.distance, selected.unit) : '—' }}
              </div>
            </div>
            <div class="kpi">
              <div class="kpi-label">{{ $t('statsPage.refuelled') }}</div>
              <div class="kpi-value">{{ selected.stats.fuelCentiliters > 0 ? formatLiters(selected.stats.fuelCentiliters) : '—' }}</div>
            </div>
          </div>
          <p v-if="selected.stats.consumption === null" class="g-secondary hint">
            {{ $t('statsPage.consumptionHint') }}
          </p>
        </section>

        <!-- Todos: comparativa por vehículo (también es la vista en tabla del gráfico) -->
        <section v-else class="g-section">
          <h3 class="g-section-title">{{ $t('statsPage.byVehicle') }}</h3>
          <table class="table">
            <thead>
              <tr>
                <th scope="col">{{ $t('common.vehicle') }}</th>
                <th scope="col" class="num">{{ $t('statsPage.spent') }}</th>
                <th scope="col" class="num">€/km</th>
                <th scope="col" class="num">L/100</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in perVehicle" :key="row.vehicle.id" @click="filter = row.vehicle.id">
                <th scope="row">
                  <span class="vehicle">
                    <VehicleAvatar :photo="row.vehicle.photo" :type="row.vehicle.type" :size="24" />
                    {{ row.vehicle.name }}
                  </span>
                </th>
                <td class="num">{{ formatMoney(row.stats.total) }}</td>
                <td class="num">{{ costPerUnit(row.stats, row.unit, true) }}</td>
                <td class="num">{{ consumption(row.stats, row.unit, true) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <details class="months">
          <summary>{{ $t('statsPage.monthByMonth') }}</summary>
          <table class="table">
            <thead>
              <tr>
                <th scope="col">{{ $t('statsPage.month') }}</th>
                <th scope="col" class="num">{{ $t('stats.maintenance') }}</th>
                <th scope="col" class="num">{{ $t('stats.fuel') }}</th>
                <th scope="col" class="num">{{ $t('stats.total') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in months" :key="m.month">
                <th scope="row">{{ monthName(m.month) }}</th>
                <td class="num">{{ formatMoney(m.maintenance) }}</td>
                <td class="num">{{ formatMoney(m.fuel) }}</td>
                <td class="num">{{ formatMoney(m.maintenance + m.fuel) }}</td>
              </tr>
            </tbody>
          </table>
        </details>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { chevronBack, chevronForward } from 'ionicons/icons';
import SpendingChart from '@/components/SpendingChart.vue';
import VehicleAvatar from '@/components/VehicleAvatar.vue';
import { formatDecimal, formatLiters, formatMoney, formatUsage, monthName } from '@/domain/format';
import { monthlySpending, vehicleYearStats, yearsWithData, type YearStats } from '@/domain/stats';
import { usageUnit, type UsageUnit } from '@/domain/units';
import { useGarageStore } from '@/stores/garage';


const store = useGarageStore();
const filter = ref<string>('all');
const currentYear = computed(() => Number(store.today.slice(0, 4)));
const year = ref(currentYear.value);

// Si se borra el vehículo filtrado, volver a "Todos".
watch(
  () => store.vehicles.map((v) => v.id),
  (ids) => {
    if (filter.value !== 'all' && !ids.includes(filter.value)) filter.value = 'all';
  },
);

const vehicleIds = computed(() => (filter.value === 'all' ? store.vehicles.map((v) => v.id) : [filter.value]));
const entries = computed(() => store.entries.filter((e) => vehicleIds.value.includes(e.vehicle_id)));
const fuelLogs = computed(() => store.fuelLogs.filter((f) => vehicleIds.value.includes(f.vehicle_id)));

const years = computed(() =>
  yearsWithData(
    store.entries.filter((e) => store.vehicleById.has(e.vehicle_id)),
    store.fuelLogs.filter((f) => store.vehicleById.has(f.vehicle_id)),
    currentYear.value,
  ),
);
const olderYear = computed(() => years.value.find((y) => y < year.value));
const newerYear = computed(() => [...years.value].reverse().find((y) => y > year.value));

const months = computed(() => monthlySpending(entries.value, fuelLogs.value, year.value));
const totals = computed(() => {
  const maintenance = months.value.reduce((s, m) => s + m.maintenance, 0);
  const fuel = months.value.reduce((s, m) => s + m.fuel, 0);
  return { maintenance, fuel, total: maintenance + fuel };
});

/** Media mensual: del año entero, o de los meses transcurridos si es el año en curso. */
const perMonth = computed(() => {
  if (totals.value.total === 0) return null;
  const elapsed = year.value === currentYear.value ? Number(store.today.slice(5, 7)) : 12;
  return formatMoney(Math.round(totals.value.total / elapsed));
});

function statsFor(vehicleId: string) {
  const vehicle = store.vehicleById.get(vehicleId)!;
  const unit = usageUnit(vehicle.type);
  const stats = vehicleYearStats(
    store.entries.filter((e) => e.vehicle_id === vehicleId),
    store.fuelLogs.filter((f) => f.vehicle_id === vehicleId),
    store.readingsByVehicle.get(vehicleId) ?? [],
    year.value,
    unit === 'km' ? 100 : 1,
  );
  return { vehicle, unit, stats };
}

const selected = computed(() => (filter.value === 'all' ? null : statsFor(filter.value)));
const perVehicle = computed(() =>
  store.vehicles.map((v) => statsFor(v.id)).sort((a, b) => b.stats.total - a.stats.total),
);

/** `bare`: solo la cifra (la unidad va en la cabecera de la tabla); las horas siempre la llevan. */
function costPerUnit(stats: YearStats, unit: UsageUnit, bare = false): string {
  if (stats.costPerUnit === null || stats.total === 0) return '—';
  // Céntimos por km: con tres decimales de euro se distingue 0,032 € de 0,038 €.
  const value = formatDecimal(stats.costPerUnit / 100, 3, 3);
  if (unit === 'h') return `${value} €/h`;
  return bare ? value : `${value} €/km`;
}

function consumption(stats: YearStats, unit: UsageUnit, bare = false): string {
  if (stats.consumption === null) return '—';
  const value = formatDecimal(stats.consumption, 1, 1);
  if (unit === 'h') return `${value} L/h`;
  return bare ? value : `${value} L/100 km`;
}
</script>

<style scoped>
.filters {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.filter {
  flex: 1;
  min-width: 0;
}
.year {
  flex: none;
  display: flex;
  align-items: center;
  margin-left: auto;
}
.year-value {
  font-size: 15px;
  font-weight: 700;
  min-width: 3.2em;
  text-align: center;
}
.hero {
  margin: 8px 0 16px;
}
.hero-label {
  font-size: 13px;
  color: var(--g-text-muted);
}
.hero-value {
  font-size: 48px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--g-text);
}
.hero-sub {
  font-size: 13px;
}
.chart-card {
  padding: 16px;
}
.no-data {
  margin: 0;
  padding: 24px 0;
  text-align: center;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.kpi {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--g-surface);
  border: 1px solid var(--g-border);
}
.kpi-label {
  font-size: 12px;
  color: var(--g-text-muted);
}
.kpi-value {
  margin-top: 2px;
  font-size: 18px;
  font-weight: 700;
  color: var(--g-text);
}
.hint {
  font-size: 13px;
  margin: 10px 2px 0;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.table th,
.table td {
  padding: 10px 4px;
  border-bottom: 1px solid var(--g-border);
  text-align: left;
  font-weight: 500;
}
.table thead th {
  font-family: var(--g-font-mono);
  font-size: 11px;
  text-transform: uppercase;
  color: var(--g-text-muted);
  border-bottom-color: var(--g-border-strong);
}
.table .num {
  text-align: right;
  font-family: var(--g-font-mono);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.table tbody tr {
  cursor: pointer;
}
.vehicle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.months {
  margin-top: 24px;
}
.months summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--g-accent-text);
  margin-bottom: 8px;
}
.months tbody tr {
  cursor: default;
}
@media (min-width: 992px) {
  .kpis {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>

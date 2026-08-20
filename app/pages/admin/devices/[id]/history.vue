<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const deviceId = route.params.id as string

const { getDevice, getDeviceMetrics } = useDevicesApi()

// Just for the page header (device name) — the heavy lifting here is the
// metrics history below, not live status, so this page does NOT poll.
const { data: device } = await useAsyncData(`admin-device-${deviceId}-header`, () => getDevice(deviceId))

const metricsRange = ref<'24' | '168'>('24') // hours: 24h or 7d
const { data: metricsData, pending, error, refresh } = await useAsyncData(
  `admin-device-${deviceId}-metrics`,
  () => getDeviceMetrics(deviceId, {
    timestamp_after: new Date(Date.now() - Number(metricsRange.value) * 3600_000).toISOString(),
    page_size: 500,
    ordering: 'timestamp',
  }),
  { watch: [metricsRange] },
)
const metrics = computed(() => metricsData.value?.results ?? [])
const metricCategories = computed(() =>
  metrics.value.map((m) =>
    new Date(m.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  )
)

// Availability: DeviceMetric doesn't store the `online` boolean
// specifically, only `link_state` (UP/DOWN/UNKNOWN) per sample — so
// availability here is derived as a simple 1/0 step series from
// link_state, which is the most honest signal the stored history
// actually gives us for "was this device reachable at this point in time".
const availabilitySeries = computed(() => [
  { name: 'Availability', data: metrics.value.map((m) => (m.link_state === 'UP' ? 1 : 0)) },
])

const rateSeries = computed(() => [
  { name: 'RX Rate (Mbps)', data: metrics.value.map((m) => Number(m.rx_rate ?? 0)) },
  { name: 'TX Rate (Mbps)', data: metrics.value.map((m) => Number(m.tx_rate ?? 0)) },
])

const loadSeries = computed(() => [
  { name: 'CPU %', data: metrics.value.map((m) => Number(m.cpu_usage ?? 0)) },
  { name: 'RAM %', data: metrics.value.map((m) => Number(m.ram_usage ?? 0)) },
])

// Kept to two series (not four) per the "keep it compact" design brief —
// errors and drops combined across RX+TX rather than four separate lines.
const issuesSeries = computed(() => [
  { name: 'Errors (RX+TX)', data: metrics.value.map((m) => (m.rx_errors ?? 0) + (m.tx_errors ?? 0)) },
  { name: 'Dropped (RX+TX)', data: metrics.value.map((m) => (m.rx_dropped ?? 0) + (m.tx_dropped ?? 0)) },
])
</script>

<template>
  <div class="space-y-6">
    <NuxtLink :to="`/admin/devices/${deviceId}`" class="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
      <ArrowLeft class="h-4 w-4" /> Back to {{ device?.device_name || 'Device' }}
    </NuxtLink>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-text-primary">History</h1>
      <div class="inline-flex rounded-card border border-border bg-surface p-0.5">
        <button
          type="button"
          class="rounded-[0.4rem] px-3 py-1 text-sm font-medium"
          :class="metricsRange === '24' ? 'bg-primary text-white' : 'text-text-secondary'"
          @click="metricsRange = '24'"
        >Last 24h</button>
        <button
          type="button"
          class="rounded-[0.4rem] px-3 py-1 text-sm font-medium"
          :class="metricsRange === '168' ? 'bg-primary text-white' : 'text-text-secondary'"
          @click="metricsRange = '168'"
        >Last 7d</button>
      </div>
    </div>

    <LoadingState v-if="pending" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState
      v-else-if="!metrics.length"
      title="No history yet"
      description="This device hasn't reported enough samples in this time range."
    />
    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-card border border-border bg-surface p-4">
        <p class="mb-2 text-sm font-medium text-text-primary">Availability</p>
        <LineChart :series="availabilitySeries" :categories="metricCategories" :colors="['#16A34A']" />
      </div>
      <div class="rounded-card border border-border bg-surface p-4">
        <p class="mb-2 text-sm font-medium text-text-primary">CPU & RAM</p>
        <LineChart :series="loadSeries" :categories="metricCategories" :colors="['#0F766E', '#D97706']" unit="%" />
      </div>
      <div class="rounded-card border border-border bg-surface p-4">
        <p class="mb-2 text-sm font-medium text-text-primary">RX/TX Rate</p>
        <LineChart :series="rateSeries" :categories="metricCategories" :colors="['#38BDF8', '#0F2747']" unit=" Mbps" />
      </div>
      <div class="rounded-card border border-border bg-surface p-4">
        <p class="mb-2 text-sm font-medium text-text-primary">Errors & Dropped Packets</p>
        <LineChart :series="issuesSeries" :categories="metricCategories" :colors="['#DC2626', '#D97706']" />
      </div>
    </div>
  </div>
</template>
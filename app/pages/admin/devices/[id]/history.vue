<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { averageField, availabilityPercent, buildMetricBuckets, getBucketRangeStart } from '~/utils/metricsBucketing'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const deviceId = route.params.id as string

const { getDevice, getDeviceMetrics } = useDevicesApi()

// Just for the page header (device name) — the heavy lifting here is the
// metrics history below, not live status, so this page does NOT poll.
const { data: device } = await useAsyncData(`admin-device-${deviceId}-header`, () => getDevice(deviceId))

const metricsRange = ref<24 | 168>(24) // hours: 24h or 7d
const { data: metricsData, pending, error, refresh } = await useAsyncData(
  `admin-device-${deviceId}-metrics`,
  () => getDeviceMetrics(deviceId, {
    timestamp_after: getBucketRangeStart(metricsRange.value).toISOString(),
    page_size: 2000,
    ordering: 'timestamp',
  }),
  { watch: [metricsRange] },
)
const rawMetrics = computed(() => metricsData.value?.results ?? [])

// Turn the raw per-heartbeat samples into a small, fixed set of time
// buckets BEFORE building chart series — this is what fixes the original
// bug: previously every raw sample's own timestamp was used as an x-axis
// label, so the 24h and 7-day views showed the same kind of "14:32, 14:41,
// 14:53..." clock-time labels regardless of range, and a busy device
// could produce hundreds of cramped, overlapping labels on the axis.
//
//   - 24h view  -> 12 buckets, 2 hours each, labelled by clock time
//   - 7-day view -> 7 buckets, 1 per calendar day, labelled by date
//
// Buckets always end at "now" and never extend into the future (see
// buildMetricBuckets), and a bucket with no samples renders as a genuine
// gap in the line rather than a fabricated zero.
const buckets = computed(() => buildMetricBuckets(rawMetrics.value, metricsRange.value))
const metricCategories = computed(() => buckets.value.map((b) => b.label))

// Availability is now a real per-bucket percentage (% of that bucket's
// heartbeats that reported link_state UP) rather than a raw 0/1 plotted
// per sample — a meaningfully better approximation of uptime, though
// still not a true time-weighted integral across the whole window (see
// availabilityPercent's doc comment).
const availabilitySeries = computed(() => [
  { name: 'Availability', data: buckets.value.map((b) => availabilityPercent(b)) },
])

const rateSeries = computed(() => [
  { name: 'RX Rate (Mbps)', data: buckets.value.map((b) => averageField(b, (m) => m.rx_rate)) },
  { name: 'TX Rate (Mbps)', data: buckets.value.map((b) => averageField(b, (m) => m.tx_rate)) },
])

const loadSeries = computed(() => [
  { name: 'CPU %', data: buckets.value.map((b) => averageField(b, (m) => m.cpu_usage)) },
  { name: 'RAM %', data: buckets.value.map((b) => averageField(b, (m) => m.ram_usage)) },
])

// Kept to two series (not four) per the "keep it compact" design brief —
// errors and drops combined across RX+TX, and averaged per bucket like
// everything else here (an "average error count per sample in this
// bucket", not a running total).
const issuesSeries = computed(() => [
  {
    name: 'Errors (RX+TX)',
    data: buckets.value.map((b) => averageField(b, (m) => (m.rx_errors ?? 0) + (m.tx_errors ?? 0))),
  },
  {
    name: 'Dropped (RX+TX)',
    data: buckets.value.map((b) => averageField(b, (m) => (m.rx_dropped ?? 0) + (m.tx_dropped ?? 0))),
  },
])

// Empty-state should reflect buckets having any data at all, not just
// whether the raw fetch returned rows — with bucketing, it's the buckets
// (not rawMetrics) that determine what's actually plottable.
const hasAnyData = computed(() => buckets.value.some((b) => b.samples.length > 0))
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
          :class="metricsRange === 24 ? 'bg-primary text-white' : 'text-text-secondary'"
          @click="metricsRange = 24"
        >Last 24h</button>
        <button
          type="button"
          class="rounded-[0.4rem] px-3 py-1 text-sm font-medium"
          :class="metricsRange === 168 ? 'bg-primary text-white' : 'text-text-secondary'"
          @click="metricsRange = 168"
        >Last 7d</button>
      </div>
    </div>

    <LoadingState v-if="pending" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState
      v-else-if="!hasAnyData"
      title="No history yet"
      description="This device hasn't reported enough samples in this time range."
    />
    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-card border border-border bg-surface p-4">
        <p class="mb-2 text-sm font-medium text-text-primary">Availability</p>
        <LineChart :series="availabilitySeries" :categories="metricCategories" :colors="['#16A34A']" unit="%" />
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
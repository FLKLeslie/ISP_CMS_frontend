<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const deviceId = route.params.id as string

const { getDevice, getDeviceMetricsSummary } = useDevicesApi()

// Just for the page header (device name) — the heavy lifting here is the
// metrics summary below, not live status, so this page does NOT poll.
const { data: device } = await useAsyncData(`admin-device-${deviceId}-header`, () => getDevice(deviceId))

const range = ref<'24h' | '7d'>('24h')
const { data: summary, pending, error, refresh } = await useAsyncData(
  `admin-device-${deviceId}-metrics-summary`,
  () => getDeviceMetricsSummary(deviceId, range.value),
  { watch: [range] },
)
const buckets = computed(() => summary.value?.buckets ?? [])
const hasAnyData = computed(() => buckets.value.some((b) => b.sample_count > 0))

// --- X-axis labels ---------------------------------------------------------
// 24h view: 24 buckets, labelled every 2 hours. Anchored from the MOST
// RECENT end backward (not from the oldest end forward) — with 24 points
// and a label every 2, anchoring from the old end leaves the last (most
// recent, most important) point unlabelled since 23 is odd. Anchoring
// from the recent end guarantees index 23 always gets a label.
//
// Each label shows the bucket's END time, not its start — a bucket
// covering 09:00-10:00 is labelled "10:00", since that's the point in
// time its data is current AS OF, which is what actually answers "is
// this up to date". Format is compact 24-hour "HH:00" (not 12-hour
// AM/PM) specifically to avoid labels overlapping/garbling in a ~460px
// chart card — 12-hour format ("08:00 PM") is visibly too wide for 12
// labels in that space.
//
// 7-day view: 42 buckets (6 per day), a label only on the FIRST bucket of
// each day, showing the date — the other 5 buckets of that day plot with
// a blank label, per "keep X-axis labels clean by displaying mainly the
// day/date rather than every bucket."
function formatHourLabel(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:00`
}
const metricCategories = computed(() => {
  const n = buckets.value.length
  return buckets.value.map((b, i) => {
    const start = new Date(b.bucket_start)
    if (range.value === '24h') {
      const end = new Date(start.getTime() + b.bucket_hours * 3600_000)
      // Anchor from the end: label i if (n-1-i) is a multiple of 2 —
      // guarantees i = n-1 (the most recent bucket) is always labelled.
      return (n - 1 - i) % 2 === 0 ? formatHourLabel(end) : ''
    }
    // 7d: 6 buckets/day — label only index 0, 6, 12, 18, 24, 30, 36 (the
    // 00:00 bucket of each day).
    return i % 6 === 0 ? start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
  })
})

// Availability's "no data" case is intentionally 0%, not a gap — the
// backend computes it as received-samples / expected-samples, so zero
// samples received genuinely means 0% available for that window. This is
// different from CPU/RAM/rates below, where "no samples" means "unknown"
// (null / a real gap), not "0%".
const availabilitySeries = computed(() => [
  { name: 'Availability', data: buckets.value.map((b) => b.availability_percent) },
])

const loadSeries = computed(() => [
  { name: 'CPU %', data: buckets.value.map((b) => b.avg_cpu_usage) },
  { name: 'RAM %', data: buckets.value.map((b) => b.avg_ram_usage) },
])

const rateSeries = computed(() => [
  { name: 'RX Rate (Mbps)', data: buckets.value.map((b) => b.avg_rx_rate) },
  { name: 'TX Rate (Mbps)', data: buckets.value.map((b) => b.avg_tx_rate) },
])

const issuesSeries = computed(() => [
  { name: 'Errors (RX+TX)', data: buckets.value.map((b) => b.sum_rx_errors + b.sum_tx_errors) },
  { name: 'Dropped (RX+TX)', data: buckets.value.map((b) => b.sum_rx_dropped + b.sum_tx_dropped) },
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
          :class="range === '24h' ? 'bg-primary text-white' : 'text-text-secondary'"
          @click="range = '24h'"
        >Last 24h</button>
        <button
          type="button"
          class="rounded-[0.4rem] px-3 py-1 text-sm font-medium"
          :class="range === '7d' ? 'bg-primary text-white' : 'text-text-secondary'"
          @click="range = '7d'"
        >Last 7d</button>
      </div>
    </div>

    <!-- Only shows on the true first load, not on every range toggle —
         keeps the chart DOM nodes mounted across toggles instead of
         destroying/recreating them (avoids both a visual flicker and an
         ApexCharts render race that throws "Element not found"). -->
    <LoadingState v-if="pending && !hasAnyData" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState
      v-else-if="!hasAnyData"
      title="No history yet"
      description="This device hasn't completed a full hour/day of reporting in this range yet."
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
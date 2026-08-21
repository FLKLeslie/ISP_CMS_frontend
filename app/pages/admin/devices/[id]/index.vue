<script setup lang="ts">
import { ArrowLeft, History, Settings } from 'lucide-vue-next'
import type { DeviceLiveStatus, NetworkHealth } from '~/utils/deviceFormat'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const deviceId = route.params.id as string

const { getDevice } = useDevicesApi()

// Note: this page intentionally applies NO subscription-status check
// anywhere — an admin can view a device's live status regardless of
// whether the owning customer currently has an active, expired, or no
// subscription at all. Device monitoring is an operational/network
// concern, not a billing one — the two are deliberately kept independent
// both here and on the backend (DeviceOwnedPermission has no subscription
// awareness at all).
const { data: device, pending, error, refresh } = await useAsyncData(
  `admin-device-${deviceId}`,
  () => getDevice(deviceId),
)

// --- Live updates without a full-page reload -----------------------------
// True push/websocket updates aren't part of this architecture (the
// frontend never talks to Node directly — see project brief), so "live"
// here means short-interval polling of Django, which already reflects
// whatever Node most recently reported.
//
// The important part: we do NOT gate the template on `pending` after the
// first load. useAsyncData keeps the last-fetched `device` value visible
// while a refresh() is in flight, so binding the template directly to
// `device.xxx` means only the specific numbers that actually changed
// re-render — Vue's fine-grained reactivity handles this for free. The
// skeleton loader below only ever shows on the very first load
// (`pending && !device`), never on the background polls that follow.
const POLL_INTERVAL_MS = 10_000
let pollHandle: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  pollHandle = setInterval(() => refresh(), POLL_INTERVAL_MS)
})
onUnmounted(() => {
  if (pollHandle) clearInterval(pollHandle)
})

const lastRefreshedAt = ref(new Date())
watch(device, () => { lastRefreshedAt.value = new Date() })

// --- Derived display values ------------------------------------------------
const status = computed<DeviceLiveStatus>(() => deriveDeviceLiveStatus(device.value?.current_status?.online))
const statusMeta: Record<DeviceLiveStatus, { label: string; tone: 'success' | 'error' | 'warning'; dot: string }> = {
  ONLINE: { label: 'Online', tone: 'success', dot: 'bg-success' },
  OFFLINE: { label: 'Offline', tone: 'error', dot: 'bg-error' },
  CONNECTING: { label: 'Connecting', tone: 'warning', dot: 'bg-warning' },
}

const cpuUsage = computed(() => device.value?.current_status?.cpu_usage)
const ramUsage = computed(() => device.value?.current_status?.ram_usage)
function healthTone(pct: string | null | undefined): 'success' | 'warning' | 'error' | 'neutral' {
  if (pct == null) return 'neutral'
  const value = parseFloat(pct)
  if (value < 70) return 'success'
  if (value < 90) return 'warning'
  return 'error'
}

const networkHealth = computed(() => deriveNetworkHealth({
  rxErrors: device.value?.current_status?.rx_errors,
  txErrors: device.value?.current_status?.tx_errors,
  rxDropped: device.value?.current_status?.rx_dropped,
  txDropped: device.value?.current_status?.tx_dropped,
  rxPackets: device.value?.current_status?.rx_packets,
  txPackets: device.value?.current_status?.tx_packets,
}))
const networkHealthMeta: Record<NetworkHealth, { label: string; tone: 'success' | 'warning' | 'error' }> = {
  HEALTHY: { label: 'Healthy', tone: 'success' },
  WARNING: { label: 'Warning', tone: 'warning' },
  POOR: { label: 'Poor', tone: 'error' },
}

const linkStateLabel = computed(() => {
  const raw = device.value?.current_status?.link_state
  if (raw === 'UP') return 'Up'
  if (raw === 'DOWN') return 'Down'
  return 'Unknown'
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <NuxtLink to="/admin/devices" class="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft class="h-4 w-4" /> Back to Devices
      </NuxtLink>
      <div class="flex items-center gap-4">
        <NuxtLink
          :to="`/admin/devices/${deviceId}/configure`"
          class="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <Settings class="h-4 w-4" /> Configure
        </NuxtLink>
        <NuxtLink
          :to="`/admin/devices/${deviceId}/history`"
          class="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <History class="h-4 w-4" /> View History
        </NuxtLink>
      </div>
    </div>

    <LoadingState v-if="pending && !device" :rows="6" />
    <ErrorState v-else-if="error && !device" @retry="refresh()" />

    <template v-else-if="device">
      <!-- 1. Device Overview -->
      <div class="rounded-card border border-border bg-surface p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="text-2xl font-semibold text-text-primary">{{ device.device_name }}</h1>
            <p class="text-sm text-text-secondary">
              {{ device.customer.user.first_name }} {{ device.customer.user.last_name }} ·
              {{ device.access_point?.name || 'No access point assigned' }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full" :class="statusMeta[status].dot" />
            <StatusBadge :label="statusMeta[status].label" :tone="statusMeta[status].tone" />
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p class="text-xs text-text-secondary">Model</p>
            <p class="text-sm font-medium text-text-primary">{{ device.model || '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">Last Seen</p>
            <p class="text-sm font-medium text-text-primary">
              {{ device.last_seen ? formatRelativeTime(device.last_seen) : 'Never' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">Uptime</p>
            <p class="text-sm font-medium text-text-primary">
              {{ formatUptime(device.current_status?.uptime_seconds) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">Updated</p>
            <p class="text-sm font-medium text-text-primary">{{ formatRelativeTime(lastRefreshedAt.toISOString()) }}</p>
          </div>
        </div>
      </div>

      <!-- 2. Device Health -->
      <div class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Device Health</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div class="mb-1 flex items-center justify-between">
              <p class="text-xs text-text-secondary">CPU Usage</p>
              <StatusBadge :label="cpuUsage != null ? `${cpuUsage}%` : '—'" :tone="healthTone(cpuUsage)" />
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-background">
              <div
                class="h-full rounded-full transition-all"
                :class="{ 'bg-success': healthTone(cpuUsage) === 'success', 'bg-warning': healthTone(cpuUsage) === 'warning', 'bg-error': healthTone(cpuUsage) === 'error' }"
                :style="{ width: `${Math.min(100, parseFloat(cpuUsage ?? '0'))}%` }"
              />
            </div>
          </div>
          <div>
            <div class="mb-1 flex items-center justify-between">
              <p class="text-xs text-text-secondary">RAM Usage</p>
              <StatusBadge :label="ramUsage != null ? `${ramUsage}%` : '—'" :tone="healthTone(ramUsage)" />
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-background">
              <div
                class="h-full rounded-full transition-all"
                :class="{ 'bg-success': healthTone(ramUsage) === 'success', 'bg-warning': healthTone(ramUsage) === 'warning', 'bg-error': healthTone(ramUsage) === 'error' }"
                :style="{ width: `${Math.min(100, parseFloat(ramUsage ?? '0'))}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Network Performance -->
      <div class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Network Performance</h2>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p class="text-xs text-text-secondary">Download Rate</p>
            <p class="text-lg font-semibold text-text-primary">{{ formatRateMbps(device.current_status?.rx_rate) }}</p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">Upload Rate</p>
            <p class="text-lg font-semibold text-text-primary">{{ formatRateMbps(device.current_status?.tx_rate) }}</p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">Data Received</p>
            <p class="text-lg font-semibold text-text-primary">{{ formatBytes(device.current_status?.rx_bytes) }}</p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">Data Transmitted</p>
            <p class="text-lg font-semibold text-text-primary">{{ formatBytes(device.current_status?.tx_bytes) }}</p>
          </div>
        </div>
      </div>

      <!-- 4. Network Quality (compact, single composite indicator) -->
      <div class="rounded-card border border-border bg-surface p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-text-primary">Network Quality</h2>
          <StatusBadge :label="networkHealthMeta[networkHealth].label" :tone="networkHealthMeta[networkHealth].tone" />
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3 text-sm text-text-secondary sm:grid-cols-4">
          <div>RX Errors: <span class="font-medium text-text-primary">{{ device.current_status?.rx_errors ?? 0 }}</span></div>
          <div>TX Errors: <span class="font-medium text-text-primary">{{ device.current_status?.tx_errors ?? 0 }}</span></div>
          <div>RX Drops: <span class="font-medium text-text-primary">{{ device.current_status?.rx_dropped ?? 0 }}</span></div>
          <div>TX Drops: <span class="font-medium text-text-primary">{{ device.current_status?.tx_dropped ?? 0 }}</span></div>
        </div>
      </div>

      <!-- 5. Wireless -->
      <div class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Wireless</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p class="text-xs text-text-secondary">Link Status</p>
            <p class="text-sm font-medium text-text-primary">{{ linkStateLabel }}</p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">Frequency</p>
            <p class="text-sm font-medium text-text-primary">{{ formatFrequencyGHz(device.current_status?.frequency) }}</p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">Channel Width</p>
            <p class="text-sm font-medium text-text-primary">{{ formatChannelWidth(device.current_status?.channel_width) }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
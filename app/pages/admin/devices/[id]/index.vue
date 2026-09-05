<script setup lang="ts">
import { ArrowLeft, History, Settings } from 'lucide-vue-next'
import type { DeviceLiveStatus, NetworkHealth } from '~/utils/deviceFormat'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const deviceId = route.params.id as string

const { getDevice, updateDevice, addDeviceUser, removeDeviceUser } = useDevicesApi()
const { listCustomers } = useCustomersApi()

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
// Uses device.online (recency-aware - see Device.is_actually_online() on
// the backend), not current_status.online directly, which is just the
// raw last-heartbeat value and never resets on its own if heartbeats
// stop arriving.
const status = computed<DeviceLiveStatus>(() => deriveDeviceLiveStatus(device.value?.online))
// True once this device has reported at least once but isn't currently
// online - the point at which the "live" figures below (uptime, CPU/RAM,
// rates) stop being trustworthy as current and are just whatever the
// last heartbeat happened to say.
const isStale = computed(() => device.value?.current_status != null && device.value?.online === false)
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

// --- Associated customers (Device.associated_customers, independent of
// the primary `device.customer`) ------------------------------------------
const addUserSearch = ref(''); const addingUser = ref(false)
const { data: addUserResults } = await useAsyncData(
  'admin-device-add-user-search',
  () => addUserSearch.value.length >= 2 ? listCustomers({ search: addUserSearch.value, page_size: 10 }) : Promise.resolve(null),
  { watch: [addUserSearch] },
)
const addUserOptions = computed(() => addUserResults.value?.results ?? [])
async function handleAddUser(customerId: string) {
  addingUser.value = true
  try { device.value = await addDeviceUser(deviceId, customerId); addUserSearch.value = '' }
  finally { addingUser.value = false }
}
async function handleRemoveUser(customerId: string) {
  device.value = await removeDeviceUser(deviceId, customerId)
}

// --- Location (manual entry, or auto-detect via the admin's own browser
// when they're on site) - both paths write to the same latitude/longitude
// fields a customer's own "set my location" uses. ---
const locationForm = reactive({ latitude: '', longitude: '' })
watch(device, (d) => {
  if (d) { locationForm.latitude = d.latitude ?? ''; locationForm.longitude = d.longitude ?? '' }
}, { immediate: true })
const savingLocation = ref(false); const detecting = ref(false)
const locationError = ref(''); const locationSuccess = ref(false)
async function handleSaveLocation() {
  locationError.value = ''; locationSuccess.value = false; savingLocation.value = true
  try {
    device.value = await updateDevice(deviceId, {
      latitude: locationForm.latitude || null, longitude: locationForm.longitude || null,
    })
    locationSuccess.value = true
  } catch { locationError.value = "Couldn't save this location. Please try again." }
  finally { savingLocation.value = false }
}
function handleAutoDetectLocation() {
  locationError.value = ''; locationSuccess.value = false
  if (!('geolocation' in navigator)) {
    locationError.value = 'Location services are not available in this browser.'
    return
  }
  detecting.value = true
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locationForm.latitude = position.coords.latitude.toFixed(6)
      locationForm.longitude = position.coords.longitude.toFixed(6)
      detecting.value = false
    },
    () => { locationError.value = 'Location permission was denied.'; detecting.value = false },
  )
}
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
              {{ device.customer ? `${device.customer.user.first_name} ${device.customer.user.last_name}` : 'No primary customer assigned' }} ·
              {{ device.access_point?.name || 'No access point assigned' }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full" :class="statusMeta[status].dot" />
            <StatusBadge :label="statusMeta[status].label" :tone="statusMeta[status].tone" />
          </div>
        </div>

        <!-- A device that isn't currently online is still showing its
             LAST reported numbers below (uptime, CPU/RAM, rates) - these
             are historical snapshots, not live data, and are visually
             muted + captioned accordingly so they aren't mistaken for
             what the device is doing right now. -->
        <p v-if="isStale" class="mt-3 rounded-card border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          This device hasn't reported in a while ({{ formatRelativeTime(device.last_seen!) }}). The figures below are from its last report, not live.
        </p>

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
          <div :class="{ 'opacity-50': isStale }">
            <p class="text-xs text-text-secondary">Uptime{{ isStale ? ' (last report)' : '' }}</p>
            <p class="text-sm font-medium text-text-primary">
              {{ formatUptime(device.current_status?.uptime_seconds) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">Page Refreshed</p>
            <p class="text-sm font-medium text-text-primary">{{ formatRelativeTime(lastRefreshedAt.toISOString()) }}</p>
          </div>
        </div>
      </div>

      <!-- 2. Device Health -->
      <div class="rounded-card border border-border bg-surface p-5">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-text-primary">Device Health</h2>
          <span v-if="isStale" class="text-xs text-text-secondary">As of last report</span>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2" :class="{ 'opacity-50': isStale }">
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
          <div :class="{ 'opacity-50': isStale }">
            <p class="text-xs text-text-secondary">Download Rate{{ isStale ? ' (last report)' : '' }}</p>
            <p class="text-lg font-semibold text-text-primary">{{ formatRateMbps(device.current_status?.rx_rate) }}</p>
          </div>
          <div :class="{ 'opacity-50': isStale }">
            <p class="text-xs text-text-secondary">Upload Rate{{ isStale ? ' (last report)' : '' }}</p>
            <p class="text-lg font-semibold text-text-primary">{{ formatRateMbps(device.current_status?.tx_rate) }}</p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">Data Received</p>
            <p class="text-lg font-semibold text-text-primary">{{ formatBytes(device.current_status?.rx_bytes) }}</p>
            <p class="text-[0.65rem] text-text-secondary">Cumulative total</p>
          </div>
          <div>
            <p class="text-xs text-text-secondary">Data Transmitted</p>
            <p class="text-lg font-semibold text-text-primary">{{ formatBytes(device.current_status?.tx_bytes) }}</p>
            <p class="text-[0.65rem] text-text-secondary">Cumulative total</p>
          </div>
        </div>
      </div>

      <!-- 4. Network Quality (compact, single composite indicator) -->
      <div class="rounded-card border border-border bg-surface p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-text-primary">Network Quality</h2>
          <StatusBadge :label="isStale ? 'Unknown (offline)' : networkHealthMeta[networkHealth].label" :tone="isStale ? 'neutral' : networkHealthMeta[networkHealth].tone" />
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
      <!-- 6. Location (manual entry, or auto-detect if the admin is on
           site - both write straight to the device's latitude/longitude,
           the same fields a customer's own "set my location" writes to) -->
      <div class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Location</h2>
        <form class="grid grid-cols-1 gap-3 sm:grid-cols-3" @submit.prevent="handleSaveLocation">
          <div>
            <label class="mb-1 block text-xs font-medium text-text-secondary">Latitude</label>
            <input v-model="locationForm.latitude" type="text" inputmode="decimal" placeholder="e.g. 4.0511" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-text-secondary">Longitude</label>
            <input v-model="locationForm.longitude" type="text" inputmode="decimal" placeholder="e.g. 9.7679" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
          </div>
          <div class="flex items-end gap-2">
            <button type="submit" :disabled="savingLocation" class="btn-primary">{{ savingLocation ? 'Saving…' : 'Save' }}</button>
            <button type="button" :disabled="detecting" class="btn-secondary" @click="handleAutoDetectLocation">{{ detecting ? 'Detecting…' : 'Auto-detect' }}</button>
          </div>
        </form>
        <p v-if="locationError" role="alert" class="mt-2 text-sm text-error">{{ locationError }}</p>
        <p v-if="locationSuccess" role="status" class="mt-2 text-sm text-success">Location saved.</p>
      </div>

      <!-- 7. Associated Customers (Device.associated_customers - separate
           from the primary `customer` above; see backend model docstring) -->
      <div class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Associated Customers</h2>
        <EmptyState v-if="!device.associated_customers.length" title="No additional customers associated with this device" />
        <ul v-else class="mb-4 space-y-2">
          <li v-for="a in device.associated_customers" :key="a.id" class="flex items-center justify-between border-b border-border pb-2 last:border-0">
            <span class="text-sm text-text-primary">{{ a.customer_name }}</span>
            <button type="button" class="text-xs font-medium text-error hover:underline" @click="handleRemoveUser(a.customer)">Remove</button>
          </li>
        </ul>
        <SearchInput v-model="addUserSearch" placeholder="Search customers to associate…" />
        <div v-if="addUserOptions.length" class="mt-2 max-h-40 overflow-y-auto rounded-card border border-border">
          <button
            v-for="c in addUserOptions" :key="c.id" type="button" :disabled="addingUser"
            class="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-text-secondary/10 disabled:opacity-50"
            @click="handleAddUser(c.id)">
            {{ c.user.first_name }} {{ c.user.last_name }} · {{ c.user.email }}
          </button>
        </div>
      </div>
    </template>
    
  </div>
</template>
<script setup lang="ts">
import { Wifi } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

const { listDevices } = useDevicesApi()
const router = useRouter()
const route = useRoute()

const page = ref(1)
const search = ref('')
const statusFilter = ref('')
// Initialized from the query string so /admin/devices?online=true (e.g.
// the "Devices Online" dashboard card) lands already filtered, matching
// the same pattern used on the customers list page.
const onlineFilter = ref((route.query.online as string) ?? '')
// Free-text model filter (matches e.g. "PBE", "NanoBeam"; the backend does a
// case-insensitive contains-match on the stored model).
const modelFilter = ref('')

const listParams = computed(() => {
  const params: Record<string, string | number | boolean> = { page: page.value, page_size: 20 }
  if (search.value) params.search = search.value
  if (statusFilter.value) params.status = statusFilter.value
  if (onlineFilter.value) params.online = onlineFilter.value === 'true'
  if (modelFilter.value) params.model = modelFilter.value
  return params
})

const { data, pending, error, refresh } = await useAsyncData(
  'admin-devices',
  () => listDevices(listParams.value),
  { watch: [listParams] },
)
const devices = computed(() => data.value?.results ?? [])
const totalPages = computed(() => data.value?.total_pages ?? 1)

function statusTone(status: string) {
  if (status === 'ACTIVE') return 'success'
  if (status === 'INACTIVE' || status === 'DECOMMISSIONED') return 'neutral'
  if (status === 'SUSPENDED') return 'warning'
  return 'error' // FAULTY
}

// Reset to page 1 whenever a filter changes, rather than staying on
// (say) page 4 of a now much-shorter filtered result set.
watch([search, statusFilter, onlineFilter, modelFilter], () => { page.value = 1 })
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-text-primary">Devices</h1>
      <NuxtLink
        to="/admin/devices/unregistered"
        class="text-sm font-medium text-accent hover:underline"
      >
        Review unregistered devices →
      </NuxtLink>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <SearchInput v-model="search" placeholder="Search by device name, MAC, serial number, or customer email…" class="sm:max-w-xs" />
      <input
        v-model.trim="modelFilter" type="text" placeholder="Filter by model…"
        class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent sm:w-44"
      >
      <select
        v-model="statusFilter"
        class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
        <option value="SUSPENDED">Suspended</option>
        <option value="FAULTY">Faulty</option>
        <option value="DECOMMISSIONED">Decommissioned</option>
      </select>
      <select
        v-model="onlineFilter"
        class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option value="">Online + Offline</option>
        <option value="true">Online only</option>
        <option value="false">Offline only</option>
      </select>
    </div>

    <LoadingState v-if="pending" :rows="8" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!devices.length" :icon="Wifi" title="No devices found" />
    <template v-else>
      <DataTable
        :columns="[
          { key: 'device_name', label: 'Device' },
          { key: 'customer', label: 'Customer' },
          { key: 'identifiers', label: 'MAC / Serial' },
          { key: 'access_point', label: 'Access Point' },
          { key: 'firmware', label: 'Firmware' },
          { key: 'status', label: 'Status' },
          { key: 'online', label: 'Link' },
          { key: 'last_seen', label: 'Last Seen' },
        ]"
        :rows="devices"
        row-key="id"
        @row-click="(row) => router.push(`/admin/devices/${row.id}`)"
      >
        <template #cell-device_name="{ row }">
          <div class="flex items-center gap-3">
            <DeviceIcon :icon-id="row.icon_id" :title="row.product_name || row.model" />
            <div>
              <div class="font-medium">{{ row.device_name }}</div>
              <div class="text-xs text-text-secondary">
                {{ row.product_name || row.model || 'Model not detected yet' }}
                <span v-if="row.product_name && row.model" class="font-mono">· {{ row.model }}</span>
              </div>
            </div>
          </div>
        </template>
        <template #cell-customer="{ row }">
          <div v-if="row.customer_name">
            <div>{{ row.customer_name }}</div>
            <div v-if="row.customer_phone" class="text-xs text-text-secondary">{{ row.customer_phone }}</div>
          </div>
          <span v-else class="text-text-secondary">Unassigned</span>
        </template>
        <template #cell-identifiers="{ row }">
          <div class="font-mono text-xs">{{ row.mac_address || '—' }}</div>
          <div class="text-xs text-text-secondary">{{ row.serial_number ? `S/N ${row.serial_number}` : 'No serial recorded' }}</div>
        </template>
        <template #cell-access_point="{ row }">
          <div>{{ row.access_point_name || '—' }}</div>
          <div v-if="row.access_point_site" class="text-xs text-text-secondary">{{ row.access_point_site }}</div>
        </template>
        <template #cell-firmware="{ row }">{{ row.firmware_version || '—' }}</template>
        <template #cell-status="{ row }">
          <StatusBadge :label="row.status" :tone="statusTone(row.status)" />
        </template>
        <template #cell-online="{ row }">
          <span class="inline-flex items-center gap-1.5">
            <span
              class="h-2 w-2 rounded-full"
              :class="row.online ? 'bg-success' : 'bg-text-secondary/40'"
            />
            {{ row.online ? 'Online' : 'Offline' }}
          </span>
          <!-- Last reported signal, so weak links stand out without opening the device.
               Muted while offline because it is then only the last known value. -->
          <div v-if="row.signal_strength != null" class="text-xs text-text-secondary" :class="{ 'opacity-50': !row.online }">
            {{ parseFloat(row.signal_strength).toFixed(0) }} dBm
          </div>
        </template>
        <template #cell-last_seen="{ row }">
          {{ row.last_seen ? formatRelativeTime(row.last_seen) : 'Never' }}
        </template>
      </DataTable>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
  </div>
</template>
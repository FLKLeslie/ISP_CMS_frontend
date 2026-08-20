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

const listParams = computed(() => {
  const params: Record<string, string | number | boolean> = { page: page.value, page_size: 20 }
  if (search.value) params.search = search.value
  if (statusFilter.value) params.status = statusFilter.value
  if (onlineFilter.value) params.online = onlineFilter.value === 'true'
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
watch([search, statusFilter, onlineFilter], () => { page.value = 1 })
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
          { key: 'access_point', label: 'Access Point' },
          { key: 'status', label: 'Status' },
          { key: 'online', label: 'Link' },
          { key: 'last_seen', label: 'Last Seen' },
        ]"
        :rows="devices"
        row-key="id"
        @row-click="(row) => router.push(`/admin/devices/${row.id}`)"
      >
        <template #cell-device_name="{ row }">
          <div class="font-medium">{{ row.device_name }}</div>
          <div class="text-xs text-text-secondary">{{ row.model || '—' }}</div>
        </template>
        <template #cell-customer="{ row }">{{ row.customer_name }}</template>
        <template #cell-access_point="{ row }">{{ row.access_point_name || '—' }}</template>
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
        </template>
        <template #cell-last_seen="{ row }">
          {{ row.last_seen ? formatRelativeTime(row.last_seen) : 'Never' }}
        </template>
      </DataTable>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
  </div>
</template>
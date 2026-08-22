<script setup lang="ts">
import { RadioTower } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

const { listAccessPoints, createAccessPoint, updateAccessPoint, deleteAccessPoint } = useAccessPointsApi()

const page = ref(1)
const search = ref('')
const statusFilter = ref('')

const listParams = computed(() => {
  const params: Record<string, string | number> = { page: page.value, page_size: 20 }
  if (search.value) params.site = search.value // matches backend's icontains-on-site filter
  if (statusFilter.value) params.status = statusFilter.value
  return params
})

const { data, pending, error, refresh } = await useAsyncData(
  'admin-access-points',
  () => listAccessPoints(listParams.value),
  { watch: [listParams] },
)
const accessPoints = computed(() => data.value?.results ?? [])
const totalPages = computed(() => data.value?.total_pages ?? 1)

function statusTone(status: string) {
  if (status === 'ONLINE') return 'success'
  if (status === 'MAINTENANCE') return 'warning'
  if (status === 'OFFLINE') return 'error'
  return 'neutral' // UNKNOWN
}

// --- Create / edit form ---------------------------------------------------
const showForm = ref(false)
const editingId = ref<string | null>(null)
const name = ref('')
const model = ref('')
const site = ref('')
const ipAddress = ref('')
const macAddress = ref('')
const description = ref('')
// Nullable on purpose, same principle as device location fields — an AP
// may exist in the system before anyone has pinned its physical location.
const latitude = ref('')
const longitude = ref('')
const locationLabel = ref('')
const saving = ref(false)
const formError = ref('')

function resetForm() {
  name.value = ''; model.value = ''; site.value = ''; ipAddress.value = ''
  macAddress.value = ''; description.value = ''
  latitude.value = ''; longitude.value = ''; locationLabel.value = ''
  formError.value = ''
}

function openCreateForm() {
  editingId.value = null
  resetForm()
  showForm.value = true
}

function openEditForm(ap: typeof accessPoints.value[number]) {
  editingId.value = ap.id
  name.value = ap.name
  model.value = ap.model
  site.value = ap.site
  ipAddress.value = ap.ip_address ?? ''
  macAddress.value = ap.mac_address ?? ''
  description.value = ap.description
  latitude.value = ap.latitude ?? ''
  longitude.value = ap.longitude ?? ''
  locationLabel.value = ap.location_label
  formError.value = ''
  showForm.value = true
}

async function handleSubmit() {
  formError.value = ''
  saving.value = true
  const payload = {
    name: name.value,
    model: model.value,
    site: site.value,
    ip_address: ipAddress.value || null,
    mac_address: macAddress.value || null,
    description: description.value,
    latitude: latitude.value || null,
    longitude: longitude.value || null,
    location_label: locationLabel.value,
  }
  try {
    if (editingId.value) {
      await updateAccessPoint(editingId.value, payload)
    } else {
      await createAccessPoint(payload)
    }
    showForm.value = false
    await refresh()
  } catch {
    formError.value = "Couldn't save this access point. Check the fields and try again."
  } finally {
    saving.value = false
  }
}

// --- Delete ---------------------------------------------------------------
const confirmDeleteId = ref<string | null>(null)
const deleting = ref(false)
async function handleDelete() {
  if (!confirmDeleteId.value) return
  deleting.value = true
  try {
    await deleteAccessPoint(confirmDeleteId.value)
    confirmDeleteId.value = null
    await refresh()
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-text-primary">Access Points</h1>
      <button
        type="button"
        class="rounded-card bg-secondary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        @click="showForm ? (showForm = false) : openCreateForm()"
      >
        {{ showForm ? 'Cancel' : 'New Access Point' }}
      </button>
    </div>

    <form
      v-if="showForm"
      class="space-y-4 rounded-card border border-border bg-surface p-5"
      @submit.prevent="handleSubmit"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Name</label>
          <input v-model="name" required class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Model</label>
          <input v-model="model" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Site</label>
          <input v-model="site" placeholder="e.g. Main Tower" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">IP Address</label>
          <input v-model="ipAddress" placeholder="Optional" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">MAC Address</label>
          <input v-model="macAddress" placeholder="Optional" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-text-primary">Description</label>
        <textarea v-model="description" rows="2" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
      </div>

      <div class="border-t border-border pt-4">
        <p class="mb-2 text-sm font-medium text-text-primary">
          Location <span class="font-normal text-text-secondary">— optional, fill in whenever convenient</span>
        </p>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input v-model="latitude" placeholder="Latitude" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
          <input v-model="longitude" placeholder="Longitude" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
          <input v-model="locationLabel" placeholder="Label, e.g. 'Rooftop, Main St'" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
      </div>

      <p v-if="formError" role="alert" class="text-sm text-error">{{ formError }}</p>

      <button
        type="submit"
        :disabled="saving"
        class="rounded-card bg-secondary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {{ saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Access Point' }}
      </button>
    </form>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <SearchInput v-model="search" placeholder="Search by site…" class="sm:max-w-xs" />
      <select
        v-model="statusFilter"
        class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option value="">All statuses</option>
        <option value="ONLINE">Online</option>
        <option value="OFFLINE">Offline</option>
        <option value="MAINTENANCE">Maintenance</option>
        <option value="UNKNOWN">Unknown</option>
      </select>
    </div>

    <LoadingState v-if="pending" :rows="6" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!accessPoints.length" :icon="RadioTower" title="No access points found" />
    <template v-else>
      <DataTable
        :columns="[
          { key: 'name', label: 'Name' },
          { key: 'site', label: 'Site' },
          { key: 'status', label: 'Status' },
          { key: 'last_seen', label: 'Last Seen' },
          { key: 'actions', label: '' },
        ]"
        :rows="accessPoints"
        row-key="id"
      >
        <template #cell-name="{ row }">
          <div class="font-medium">{{ row.name }}</div>
          <div class="text-xs text-text-secondary">{{ row.model || '—' }}</div>
        </template>
        <template #cell-site="{ row }">{{ row.site || '—' }}</template>
        <template #cell-status="{ row }">
          <StatusBadge :label="row.status" :tone="statusTone(row.status)" />
        </template>
        <template #cell-last_seen="{ row }">
          {{ row.last_seen ? formatRelativeTime(row.last_seen) : 'Never' }}
        </template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-3">
            <button type="button" class="text-sm font-medium text-accent hover:underline" @click="openEditForm(row)">Edit</button>
            <button type="button" class="text-sm font-medium text-error hover:underline" @click="confirmDeleteId = row.id">Delete</button>
          </div>
        </template>
      </DataTable>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>

    <ConfirmationDialog
      :open="!!confirmDeleteId"
      title="Delete this access point?"
      description="Any devices currently assigned to it will keep their record but lose this AP association. This can't be undone."
      confirm-label="Delete"
      danger
      @confirm="handleDelete"
      @cancel="confirmDeleteId = null"
    />
  </div>
</template>
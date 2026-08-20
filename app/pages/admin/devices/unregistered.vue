<script setup lang="ts">
import { Router } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

const { listSightings, registerSighting, discardSighting } = useUnregisteredDevicesApi()
const { listCustomers } = useCustomersApi()
const { listAccessPointsWithLocation } = useAccessPointsApi()

// --- List / filter state ---------------------------------------------------
// Defaults to PENDING - this page is primarily a "needs your attention"
// queue, not a general audit log. The status filter lets an admin switch
// to Registered/Discarded/All to see history.
const statusFilter = ref<'PENDING' | 'REGISTERED' | 'DISCARDED' | ''>('PENDING')
const page = ref(1)

const listParams = computed(() => {
  const params: Record<string, string | number> = { page: page.value, page_size: 20 }
  if (statusFilter.value) params.status = statusFilter.value
  return params
})

const { data, pending, error, refresh } = await useAsyncData(
  'admin-unregistered-devices',
  () => listSightings(listParams.value),
  { watch: [listParams] },
)
const sightings = computed(() => data.value?.results ?? [])
const totalPages = computed(() => data.value?.total_pages ?? 1)

function statusTone(status: string) {
  if (status === 'PENDING') return 'warning'
  if (status === 'REGISTERED') return 'success'
  return 'neutral' // DISCARDED
}

// Surface a couple of the more useful raw sample fields inline, without
// trying to render the whole arbitrary JSON blob — signal_strength in
// particular helps an admin judge "is this actually near one of our APs"
// before deciding to register or discard.
function sampleSummary(sample: Record<string, unknown>): string {
  const parts: string[] = []
  if (sample.signal_strength != null) parts.push(`${sample.signal_strength} dBm`)
  if (sample.online != null) parts.push(sample.online ? 'reporting online' : 'reporting offline')
  return parts.length ? parts.join(' · ') : 'No metrics reported yet'
}

// --- Register panel ---------------------------------------------------------
// Same expand-in-place pattern as the Suggestions respond flow — keeps the
// admin in the queue context rather than navigating away mid-review.
const openId = ref<string | null>(null)
const registering = ref(false)
const registerError = ref('')

const customerSearch = ref('')
const { data: customerResults } = await useAsyncData(
  'admin-sightings-customer-search',
  () => customerSearch.value.length >= 2
    ? listCustomers({ search: customerSearch.value, page_size: 10 })
    : Promise.resolve(null),
  { watch: [customerSearch] },
)
const customerOptions = computed(() => customerResults.value?.results ?? [])
const selectedCustomerId = ref('')

const { data: accessPointsData } = await useAsyncData(
  'admin-sightings-access-points',
  () => listAccessPointsWithLocation(),
)
const accessPointOptions = computed(() => accessPointsData.value?.results ?? [])
const selectedAccessPointId = ref('')

const deviceName = ref('')
const notes = ref('')

function openRegisterForm(id: string) {
  openId.value = openId.value === id ? null : id
  registerError.value = ''
  deviceName.value = ''
  notes.value = ''
  selectedCustomerId.value = ''
  selectedAccessPointId.value = ''
  customerSearch.value = ''
}

async function handleRegister(id: string) {
  registerError.value = ''
  if (!selectedCustomerId.value || !deviceName.value.trim()) {
    registerError.value = 'Pick a customer and give the device a name first.'
    return
  }
  registering.value = true
  try {
    await registerSighting(id, {
      customer: selectedCustomerId.value,
      device_name: deviceName.value,
      access_point: selectedAccessPointId.value || null,
      notes: notes.value,
    })
    openId.value = null
    await refresh()
  } catch {
    registerError.value = "Couldn't register this device. Check the fields and try again."
  } finally {
    registering.value = false
  }
}

const discarding = ref<string | null>(null)
async function handleDiscard(id: string) {
  discarding.value = id
  try {
    await discardSighting(id)
    await refresh()
  } catch {
    // Nothing destructive happened server-side on failure - the sighting
    // just stays PENDING and visible, so a silent no-op here is safe; the
    // admin can simply try again.
  } finally {
    discarding.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-text-primary">Unregistered Devices</h1>
      <p class="mt-1 text-sm text-text-secondary">
        Devices that pinged our network but aren't linked to a customer yet. Register them to
        the right customer, or discard if it's not one of ours.
      </p>
    </div>

    <div class="inline-flex flex-wrap rounded-card border border-border bg-surface p-0.5" role="tablist">
      <button
        v-for="t in [
          { key: 'PENDING', label: 'Needs Review' },
          { key: 'REGISTERED', label: 'Registered' },
          { key: 'DISCARDED', label: 'Discarded' },
          { key: '', label: 'All' },
        ]"
        :key="t.key"
        type="button"
        class="rounded-[0.4rem] px-4 py-1.5 text-sm font-medium transition-colors"
        :class="statusFilter === t.key ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
        @click="statusFilter = t.key as any; page = 1"
      >
        {{ t.label }}
      </button>
    </div>

    <LoadingState v-if="pending" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState
      v-else-if="!sightings.length"
      :icon="Router"
      title="Nothing here"
      :description="statusFilter === 'PENDING' ? 'No unregistered devices waiting for review right now.' : undefined"
    />
    <template v-else>
      <div class="space-y-3">
        <div
          v-for="s in sightings"
          :key="s.id"
          class="rounded-card border border-border bg-surface p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="font-mono text-sm font-semibold text-text-primary">{{ s.mac_address }}</p>
              <p class="text-xs text-text-secondary">
                First seen {{ formatDateTime(s.first_seen) }} · Last seen {{ formatRelativeTime(s.last_seen) }}
                · {{ s.sighting_count }} {{ s.sighting_count === 1 ? 'ping' : 'pings' }}
              </p>
              <p class="mt-1 text-xs text-text-secondary">{{ sampleSummary(s.last_sample) }}</p>
            </div>
            <StatusBadge :label="s.status" :tone="statusTone(s.status)" />
          </div>

          <div v-if="s.status === 'REGISTERED'" class="mt-2 text-sm text-text-secondary">
            Registered as <span class="font-medium text-text-primary">{{ s.resolved_device_name }}</span>
            by {{ s.resolved_by_name }} · {{ formatDateTime(s.resolved_at) }}
          </div>
          <div v-else-if="s.status === 'DISCARDED'" class="mt-2 text-sm text-text-secondary">
            Discarded by {{ s.resolved_by_name }} · {{ formatDateTime(s.resolved_at) }}
          </div>

          <div v-if="s.status === 'PENDING'" class="mt-3 flex gap-3">
            <button
              type="button"
              class="text-sm font-medium text-accent hover:underline"
              @click="openRegisterForm(s.id)"
            >
              {{ openId === s.id ? 'Cancel' : 'Register to a customer' }}
            </button>
            <button
              type="button"
              :disabled="discarding === s.id"
              class="text-sm font-medium text-text-secondary hover:underline disabled:opacity-50"
              @click="handleDiscard(s.id)"
            >
              {{ discarding === s.id ? 'Discarding…' : 'Discard' }}
            </button>
          </div>

          <div v-if="openId === s.id" class="mt-4 space-y-3 border-t border-border pt-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-text-primary">Customer</label>
              <SearchInput v-model="customerSearch" placeholder="Search by name or email…" />
              <div v-if="customerOptions.length" class="mt-2 max-h-40 overflow-y-auto rounded-card border border-border">
                <button
                  v-for="c in customerOptions"
                  :key="c.id"
                  type="button"
                  class="block w-full px-3 py-2 text-left text-sm hover:bg-text-secondary/10"
                  :class="selectedCustomerId === c.id ? 'bg-accent/10 text-accent' : 'text-text-primary'"
                  @click="selectedCustomerId = c.id; customerSearch = `${c.user.first_name} ${c.user.last_name}`"
                >
                  {{ c.user.first_name }} {{ c.user.last_name }} — {{ c.user.email }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-sm font-medium text-text-primary">Device name</label>
                <input
                  v-model="deviceName"
                  required
                  placeholder="e.g. Rooftop Unit"
                  class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-text-primary">Access point (optional)</label>
                <select
                  v-model="selectedAccessPointId"
                  class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                >
                  <option value="">None yet</option>
                  <option v-for="ap in accessPointOptions" :key="ap.id" :value="ap.id">{{ ap.name }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="mb-1 block text-sm font-medium text-text-primary">Notes (optional)</label>
              <textarea
                v-model="notes"
                rows="2"
                class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>

            <p v-if="registerError" role="alert" class="text-sm text-error">{{ registerError }}</p>

            <button
              type="button"
              :disabled="registering"
              class="rounded-card bg-secondary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              @click="handleRegister(s.id)"
            >
              {{ registering ? 'Registering…' : 'Register Device' }}
            </button>
          </div>
        </div>
      </div>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
  </div>
</template>
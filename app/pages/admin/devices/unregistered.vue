<script setup lang="ts">
import { Router } from 'lucide-vue-next'
import type { UnregisteredDeviceSighting } from '~/types/api/devices'

definePageMeta({ layout: 'admin' })

const { listSightings, registerSighting, registerSightingAsAccessPoint, discardSighting } = useUnregisteredDevicesApi()
const { listCustomers, createCustomer } = useCustomersApi()
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
const registerMode = ref<'station' | 'access-point'>('station')
const apSite = ref('')

function roleLabel(role: string) {
  if (role === 'access-point') return 'Access Point'
  if (role === 'station') return 'Station'
  return 'Unknown role'
}

// Registering an access-point creates infrastructure, not a customer
// device - so it needs a name and optional site, never a customer.
async function handleRegisterAccessPoint(id: string, confirmReplace = false) {
  registerError.value = ''
  if (!deviceName.value.trim()) {
    registerError.value = 'Give this access point a name first.'
    return
  }
  registering.value = true
  try {
    await registerSightingAsAccessPoint(
      id, { name: deviceName.value, site: apSite.value }, confirmReplace,
    )
    openId.value = null
    apReplaceConflict.value = null
    await refresh()
  } catch (err: any) {
    const conflict = err?.data?.errors?.conflict || err?.data?.conflict
    if (conflict) {
      apReplaceConflict.value = { sightingId: id, ...conflict }
    } else {
      registerError.value = apiErrorMessage(err, "Couldn't register this access point. Please try again.")
    }
  } finally {
    registering.value = false
  }
}

const apReplaceConflict = ref<{
  sightingId: string
  existing_access_point_id: string
  existing_access_point_name: string
} | null>(null)
const apReplaceConflictDescription = computed(() => {
  const conflict = apReplaceConflict.value
  if (!conflict) return ''
  return `An access point already exists with this MAC address: "${conflict.existing_access_point_name}". `
    + "Registering now will overwrite its details with what you entered here. This can't be undone."
})
function handleConfirmApReplace() {
  if (!apReplaceConflict.value) return
  handleRegisterAccessPoint(apReplaceConflict.value.sightingId, true)
}

function openRegisterForm(sighting: UnregisteredDeviceSighting) {
  const id = sighting.id
  openId.value = openId.value === id ? null : id
  registerError.value = ''
  // Pre-fill from the auto-detected name (see devices.node_client.
  // fetch_device_name on the backend) if Node was able to look one up
  // when this sighting was first seen - still fully editable, just saves
  // typing when it's right.
  deviceName.value = sighting.detected_name || ''
  // Default the form to whatever the device reported itself as - an
  // access-point becomes infrastructure, a station becomes a customer's
  // device. The admin can still override this either way.
  registerMode.value = sighting.detected_role === 'access-point' ? 'access-point' : 'station'
  apSite.value = ''
  notes.value = ''
  selectedCustomerId.value = ''
  selectedAccessPointId.value = ''
  customerSearch.value = ''
  showNewCustomerForm.value = false
  Object.assign(newCustomerForm, { first_name: '', last_name: '', email: '', password: '', phone_number: '' })
  newCustomerError.value = ''
}

// --- Create a customer inline, for a device sighting from someone not
// yet in the system - skips navigating away from the review queue. -----
const showNewCustomerForm = ref(false)
const newCustomerForm = reactive({ first_name: '', last_name: '', email: '', password: '', phone_number: '' })
const creatingCustomer = ref(false); const newCustomerError = ref('')
async function handleCreateCustomer() {
  newCustomerError.value = ''; creatingCustomer.value = true
  try {
    const customer = await createCustomer({ ...newCustomerForm })
    selectedCustomerId.value = customer.id
    customerSearch.value = `${customer.user.first_name} ${customer.user.last_name}`
    showNewCustomerForm.value = false
  } catch (err) { newCustomerError.value = apiErrorMessage(err, "Couldn't create this customer. Check the fields and try again.") }
  finally { creatingCustomer.value = false }
}

async function handleRegister(id: string, confirmReplace = false) {
  registerError.value = ''
  if (!selectedCustomerId.value || !deviceName.value.trim()) {
    registerError.value = 'Pick a customer and give the device a name first.'
    return
  }
  registering.value = true
  try {
    await registerSighting(
      id,
      {
        customer: selectedCustomerId.value,
        device_name: deviceName.value,
        access_point: selectedAccessPointId.value || null,
        notes: notes.value,
      },
      confirmReplace,
    )
    openId.value = null
    replaceConflict.value = null
    await refresh()
  } catch (err: any) {
    if (err?.data?.errors?.conflict || err?.data?.conflict) {
      // A Device already exists for this MAC - show the admin exactly
      // what registering now would overwrite, and let them decide rather
      // than silently adopting or refusing outright.
      replaceConflict.value = { sightingId: id, ...(err.data.errors?.conflict ?? err.data.conflict) }
    } else {
      registerError.value = apiErrorMessage(err, "Couldn't register this device. Check the fields and try again.")
    }
  } finally {
    registering.value = false
  }
}

// --- MAC-address conflict confirmation -----------------------------------
// Populated when the backend refuses a register attempt because a Device
// already exists for this sighting's MAC (see useUnregisteredDevicesApi.
// registerSighting's docstring). Registering again with confirmReplace:
// true will overwrite that existing device's name/customer/access point/
// notes with whatever's currently in the form.
const replaceConflict = ref<{
  sightingId: string
  existing_device_id: string
  existing_device_name: string
  existing_customer_name: string | null
  existing_is_deleted: boolean
} | null>(null)

function handleConfirmReplace() {
  if (!replaceConflict.value) return
  handleRegister(replaceConflict.value.sightingId, true)
}
const replaceConflictDescription = computed(() => {
  const conflict = replaceConflict.value
  if (!conflict) return ''
  const owner = conflict.existing_customer_name
    ? `, linked to ${conflict.existing_customer_name}`
    : ', not linked to any customer'
  const deletedNote = conflict.existing_is_deleted ? ' This device was previously deactivated.' : ''
  const name = conflict.existing_device_name || 'Unnamed device'
  return `A device already exists with this MAC address: "${name}"${owner}.${deletedNote} `
    + "Registering now will overwrite its name, customer, access point, and notes with what you entered here. This can't be undone."
})

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
              <p v-if="s.detected_name" class="mt-0.5 text-sm text-secondary">
                Detected as "{{ s.detected_name }}"<span v-if="s.detected_model"> · {{ s.detected_model }}</span>
              </p>
              <p v-if="s.detected_role" class="mt-0.5">
                <StatusBadge :label="roleLabel(s.detected_role)" :tone="s.detected_role === 'access-point' ? 'info' : 'neutral'" />
              </p>
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
              @click="openRegisterForm(s)"
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
            <!-- What kind of record this becomes. Pre-set from the device's
                 own reported role, but the admin has the final say. -->
            <div>
              <label class="mb-1 block text-sm font-medium text-text-primary">Register as</label>
              <div class="inline-flex rounded-card border border-border bg-background p-0.5">
                <button
                  v-for="m in [{ key: 'station', label: 'Customer device' }, { key: 'access-point', label: 'Access point' }]"
                  :key="m.key" type="button"
                  class="rounded-[0.4rem] px-3 py-1.5 text-sm font-medium transition-colors"
                  :class="registerMode === m.key ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
                  @click="registerMode = m.key as any"
                >{{ m.label }}</button>
              </div>
              <p v-if="s.detected_role === 'access-point' && registerMode === 'station'" class="mt-1 text-xs text-warning">
                This device reports itself as an access point — registering it to a customer is unusual.
              </p>
            </div>

            <!-- Access point form -->
            <template v-if="registerMode === 'access-point'">
              <div>
                <label class="mb-1 block text-sm font-medium text-text-primary">Access point name</label>
                <input v-model="deviceName" placeholder="e.g. Rooftop AP" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-text-primary">Site (optional)</label>
                <input v-model="apSite" placeholder="Where it's installed" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
              </div>
              <p v-if="registerError" role="alert" class="text-sm text-error">{{ registerError }}</p>
              <button type="button" :disabled="registering" class="btn-primary" @click="handleRegisterAccessPoint(s.id)">
                {{ registering ? 'Registering…' : 'Register Access Point' }}
              </button>
            </template>

            <!-- Customer device form -->
            <template v-else>
            <div>
              <div class="mb-1 flex items-center justify-between">
                <label class="block text-sm font-medium text-text-primary">Customer</label>
                <button type="button" class="text-xs font-medium text-secondary hover:underline" @click="showNewCustomerForm = !showNewCustomerForm">
                  {{ showNewCustomerForm ? 'Cancel' : "Customer not in the system? Create one" }}
                </button>
              </div>
              <form v-if="showNewCustomerForm" class="mb-3 grid grid-cols-1 gap-2 rounded-card border border-border bg-background/40 p-3 sm:grid-cols-2" @submit.prevent="handleCreateCustomer">
                <input v-model="newCustomerForm.first_name" placeholder="First name" required class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
                <input v-model="newCustomerForm.last_name" placeholder="Last name" required class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
                <input v-model="newCustomerForm.email" type="email" placeholder="Email" required class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
                <input v-model="newCustomerForm.password" placeholder="Temporary password" required class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
                <input v-model="newCustomerForm.phone_number" placeholder="Phone (optional)" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent sm:col-span-2">
                <p v-if="newCustomerError" role="alert" class="text-xs text-error sm:col-span-2">{{ newCustomerError }}</p>
                <button type="submit" :disabled="creatingCustomer" class="btn-primary sm:col-span-2">{{ creatingCustomer ? 'Creating…' : 'Create and select customer' }}</button>
              </form>
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
              class="btn-primary"
              @click="handleRegister(s.id)"
            >
              {{ registering ? 'Registering…' : 'Register Device' }}
            </button>
            </template>
          </div>
        </div>
      </div>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
    <ConfirmationDialog
      :open="!!apReplaceConflict"
      title="Replace the existing access point?"
      :description="apReplaceConflictDescription"
      :confirm-label="registering ? 'Please wait…' : 'Replace access point'"
      danger
      @confirm="handleConfirmApReplace"
      @cancel="apReplaceConflict = null"
    />
    <ConfirmationDialog
      :open="!!replaceConflict"
      title="Replace the existing device?"
      :description="replaceConflictDescription"
      :confirm-label="registering ? 'Please wait…' : 'Replace device'"
      danger
      @confirm="handleConfirmReplace"
      @cancel="replaceConflict = null"
    />
  </div>
</template>
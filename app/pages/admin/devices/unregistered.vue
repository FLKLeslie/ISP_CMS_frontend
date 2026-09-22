<script setup lang="ts">
import { Router } from 'lucide-vue-next'
import type { UnregisteredDeviceSighting } from '~/types/api/devices'

definePageMeta({ layout: 'admin' })

const { listSightings, registerSighting, registerSightingAsAccessPoint, discardSighting, redetectSighting } = useUnregisteredDevicesApi()
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

// --- What kind of device is this? -------------------------------------------
// The role comes from the device itself (see the backend's detect_sighting_
// details). It can legitimately be UNKNOWN: the device may not have answered
// yet, or reported too little to classify (e.g. advanced wireless
// configuration). That is shown as "uncertain" rather than hidden, because it
// changes what the administrator has to do: decide for themselves.
type Role = 'access-point' | 'station' | 'uncertain'
const roleOf = (s: UnregisteredDeviceSighting): Role => (s.detected_role === 'access-point' || s.detected_role === 'station' ? s.detected_role : 'uncertain')
const roleView: Record<Role, { label: string; tone: 'info' | 'success' | 'warning' }> = {
  'access-point': { label: 'Access Point', tone: 'info' },
  station: { label: 'Station', tone: 'success' },
  uncertain: { label: 'Role uncertain', tone: 'warning' },
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

// A quiet background refresh, so a device whose details get filled in by the
// automatic retry updates on screen without anyone pressing anything. Only
// while something is actually uncertain, and never while a form is open.
let poller: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  poller = setInterval(() => {
    const unsure = sightings.value.some((s) => s.status === 'PENDING' && (roleOf(s) === 'uncertain' || !s.detected_name))
    if (!document.hidden && unsure && !openId.value) refresh()
  }, 15_000)
})
onBeforeUnmount(() => clearInterval(poller))

// --- Re-check: ask the device again -----------------------------------------------
const rechecking = ref<string | null>(null)
const recheckMessage = reactive<Record<string, string>>({})
async function handleRecheck(s: UnregisteredDeviceSighting) {
  rechecking.value = s.id
  delete recheckMessage[s.id]
  const before = `${s.detected_role}|${s.detected_name}|${s.detected_model}`
  try {
    const updated = await redetectSighting(s.id)
    const index = data.value?.results.findIndex((r) => r.id === s.id) ?? -1
    if (index !== -1 && data.value) data.value.results[index] = updated
    const learned = `${updated.detected_role}|${updated.detected_name}|${updated.detected_model}` !== before
    recheckMessage[s.id] = learned
      ? 'Updated from the device.'
      : "The device didn't give us anything new. It may be offline, or it may not report its role — you can still register it yourself."
  } catch (err) {
    recheckMessage[s.id] = apiErrorMessage(err, "Couldn't re-check this device. Please try again.")
  } finally {
    rechecking.value = null
  }
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
// Which kind of record the open form creates. Chosen by WHICH BUTTON the admin
// pressed (Register AP / Register to a customer), so it always matches intent.
const registerMode = ref<'station' | 'access-point'>('station')
const apSite = ref('')

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

// Opens (or closes, if already open in the same mode) the form for a sighting.
function openRegisterForm(sighting: UnregisteredDeviceSighting, mode: 'station' | 'access-point') {
  const same = openId.value === sighting.id && registerMode.value === mode
  openId.value = same ? null : sighting.id
  registerMode.value = mode
  registerError.value = ''
  // Pre-fill from the name the device reported for itself, if we got one - still
  // fully editable, just saves typing when it's right (and is left blank, not
  // guessed, when we don't know).
  deviceName.value = sighting.detected_name || ''
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

const field = 'w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent'
const tab = (active: boolean) => (active ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary')
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-text-primary">Unregistered Devices</h1>
      <p class="mt-1 text-sm text-text-secondary">
        Devices that pinged our network but aren't registered yet. Access points are registered as access points;
        stations are registered to the customer they belong to.
      </p>
    </div>

    <div class="overflow-x-auto">
      <div class="inline-flex min-w-max rounded-card border border-border bg-surface p-0.5" role="tablist">
        <button
          v-for="t in [
            { key: 'PENDING', label: 'Needs Review' },
            { key: 'REGISTERED', label: 'Registered' },
            { key: 'DISCARDED', label: 'Discarded' },
            { key: '', label: 'All' },
          ]"
          :key="t.key" type="button" role="tab" :aria-selected="statusFilter === t.key"
          class="whitespace-nowrap rounded-[0.4rem] px-4 py-1.5 text-sm font-medium transition-colors"
          :class="tab(statusFilter === t.key)"
          @click="statusFilter = t.key as any; page = 1"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <LoadingState v-if="pending && !data" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState
      v-else-if="!sightings.length"
      :icon="Router"
      title="Nothing here"
      :description="statusFilter === 'PENDING' ? 'No unregistered devices waiting for review right now.' : undefined"
    />
    <template v-else>
      <div class="space-y-3">
        <div v-for="s in sightings" :key="s.id" class="rounded-card border border-border bg-surface p-4">
          <!-- Identity -->
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-base font-semibold text-text-primary">{{ s.detected_name || 'Unnamed device' }}</p>
              <p class="break-all font-mono text-xs text-text-secondary">{{ s.mac_address }}<span v-if="s.detected_model" class="font-sans"> · {{ s.detected_model }}</span></p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <StatusBadge :label="roleView[roleOf(s)].label" :tone="roleView[roleOf(s)].tone" />
              <StatusBadge :label="s.status === 'PENDING' ? 'Pending review' : s.status === 'REGISTERED' ? 'Registered' : 'Discarded'" :tone="statusTone(s.status)" />
            </div>
          </div>

          <p class="mt-2 text-xs text-text-secondary">
            First seen {{ formatDateTime(s.first_seen) }} · Last seen {{ formatRelativeTime(s.last_seen) }}
            · {{ s.sighting_count }} {{ s.sighting_count === 1 ? 'ping' : 'pings' }}
          </p>
          <p class="text-xs text-text-secondary">{{ sampleSummary(s.last_sample) }}</p>

          <!-- Uncertain: say so plainly, and offer another go -->
          <div v-if="s.status === 'PENDING' && (roleOf(s) === 'uncertain' || !s.detected_name)" class="mt-3 rounded-card border border-warning/40 bg-warning/5 px-3 py-2">
            <p class="text-sm text-text-primary">
              <template v-if="roleOf(s) === 'uncertain'">
                We couldn't tell whether this is an access point or a station — the device didn't answer, or didn't report enough.
              </template>
              <template v-else>We couldn't read this device's name.</template>
              You can check again, or decide yourself below.
            </p>
            <p v-if="s.detection_checked_at" class="mt-0.5 text-xs text-text-secondary">Last checked {{ formatRelativeTime(s.detection_checked_at) }}.</p>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" :disabled="rechecking === s.id" class="btn-secondary" @click="handleRecheck(s)">
                {{ rechecking === s.id ? 'Checking…' : 'Check again' }}
              </button>
              <p v-if="recheckMessage[s.id]" role="status" class="text-xs text-text-secondary">{{ recheckMessage[s.id] }}</p>
            </div>
          </div>
          <p v-else-if="recheckMessage[s.id]" role="status" class="mt-2 text-xs text-text-secondary">{{ recheckMessage[s.id] }}</p>

          <div v-if="s.status === 'REGISTERED'" class="mt-3 text-sm text-text-secondary">
            Registered<template v-if="s.resolved_device_name"> as <span class="font-medium text-text-primary">{{ s.resolved_device_name }}</span></template>
            by {{ s.resolved_by_name }} · {{ formatDateTime(s.resolved_at) }}
          </div>
          <div v-else-if="s.status === 'DISCARDED'" class="mt-3 text-sm text-text-secondary">
            Discarded by {{ s.resolved_by_name }} · {{ formatDateTime(s.resolved_at) }}
          </div>

          <!-- Actions: the button matches the role; uncertain shows both -->
          <div v-if="s.status === 'PENDING'" class="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              v-if="roleOf(s) !== 'station'" type="button" class="btn-primary"
              @click="openRegisterForm(s, 'access-point')"
            >{{ openId === s.id && registerMode === 'access-point' ? 'Cancel' : 'Register AP' }}</button>
            <button
              v-if="roleOf(s) !== 'access-point'" type="button" class="btn-primary"
              @click="openRegisterForm(s, 'station')"
            >{{ openId === s.id && registerMode === 'station' ? 'Cancel' : 'Register to a customer' }}</button>
            <button type="button" :disabled="discarding === s.id" class="btn-secondary" @click="handleDiscard(s.id)">
              {{ discarding === s.id ? 'Discarding…' : 'Discard' }}
            </button>
            <!-- The detected role is a suggestion, never a restriction -->
            <button
              v-if="roleOf(s) !== 'uncertain'" type="button" class="text-left text-xs font-medium text-text-secondary hover:text-text-primary hover:underline sm:ml-auto"
              @click="openRegisterForm(s, roleOf(s) === 'access-point' ? 'station' : 'access-point')"
            >
              {{ roleOf(s) === 'access-point' ? 'Actually a customer\'s station? Register it to a customer' : 'Actually an access point? Register it as one' }}
            </button>
          </div>

          <!-- Register form -->
          <div v-if="openId === s.id" class="mt-4 space-y-3 border-t border-border pt-4">
            <p v-if="roleOf(s) === 'access-point' && registerMode === 'station'" class="rounded-card border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-text-primary">
              This device reports itself as an access point — registering it to a customer is unusual.
            </p>
            <p v-else-if="roleOf(s) === 'station' && registerMode === 'access-point'" class="rounded-card border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-text-primary">
              This device reports itself as a station — registering it as an access point is unusual.
            </p>

            <!-- Access point -->
            <template v-if="registerMode === 'access-point'">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label class="mb-1 block text-sm font-medium text-text-primary">Access point name</label>
                  <input v-model="deviceName" placeholder="e.g. Rooftop AP" :class="field">
                  <p v-if="s.detected_name" class="mt-1 text-xs text-text-secondary">Filled in from the device — change it if you like.</p>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium text-text-primary">Site (optional)</label>
                  <input v-model="apSite" placeholder="Where it's installed" :class="field">
                </div>
              </div>
              <p v-if="registerError" role="alert" class="text-sm text-error">{{ registerError }}</p>
              <button type="button" :disabled="registering" class="btn-primary" @click="handleRegisterAccessPoint(s.id)">
                {{ registering ? 'Registering…' : 'Register AP' }}
              </button>
            </template>

            <!-- Station / customer device -->
            <template v-else>
              <div>
                <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <label class="block text-sm font-medium text-text-primary">Customer</label>
                  <button type="button" class="text-xs font-medium text-secondary hover:underline" @click="showNewCustomerForm = !showNewCustomerForm">
                    {{ showNewCustomerForm ? 'Cancel' : 'Customer not in the system? Create one' }}
                  </button>
                </div>
                <form v-if="showNewCustomerForm" class="mb-3 grid grid-cols-1 gap-2 rounded-card border border-border bg-background p-3 sm:grid-cols-2" @submit.prevent="handleCreateCustomer">
                  <input v-model="newCustomerForm.first_name" placeholder="First name" required :class="field">
                  <input v-model="newCustomerForm.last_name" placeholder="Last name" required :class="field">
                  <input v-model="newCustomerForm.email" type="email" placeholder="Email" required :class="field">
                  <input v-model="newCustomerForm.password" placeholder="Temporary password" required :class="field">
                  <input v-model="newCustomerForm.phone_number" placeholder="Phone (optional)" :class="field" class="sm:col-span-2">
                  <p v-if="newCustomerError" role="alert" class="text-xs text-error sm:col-span-2">{{ newCustomerError }}</p>
                  <button type="submit" :disabled="creatingCustomer" class="btn-primary sm:col-span-2">{{ creatingCustomer ? 'Creating…' : 'Create and select customer' }}</button>
                </form>
                <SearchInput v-model="customerSearch" placeholder="Search by name or email…" />
                <div v-if="customerOptions.length" class="mt-2 max-h-44 overflow-y-auto rounded-card border border-border">
                  <button
                    v-for="c in customerOptions" :key="c.id" type="button"
                    class="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-text-secondary/10"
                    :class="selectedCustomerId === c.id ? 'bg-secondary/10 font-medium text-secondary' : 'text-text-primary'"
                    @click="selectedCustomerId = c.id; customerSearch = `${c.user.first_name} ${c.user.last_name}`"
                  >
                    {{ c.user.first_name }} {{ c.user.last_name }} — {{ c.user.email }}
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label class="mb-1 block text-sm font-medium text-text-primary">Device name</label>
                  <input v-model="deviceName" required placeholder="e.g. Rooftop Unit" :class="field">
                  <p v-if="s.detected_name" class="mt-1 text-xs text-text-secondary">Filled in from the device — change it if you like.</p>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium text-text-primary">Access point (optional)</label>
                  <select v-model="selectedAccessPointId" :class="field">
                    <option value="">None yet</option>
                    <option v-for="ap in accessPointOptions" :key="ap.id" :value="ap.id">{{ ap.name }}</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-text-primary">Notes (optional)</label>
                <textarea v-model="notes" rows="2" :class="field" />
              </div>

              <p v-if="registerError" role="alert" class="text-sm text-error">{{ registerError }}</p>
              <button type="button" :disabled="registering" class="btn-primary" @click="handleRegister(s.id)">
                {{ registering ? 'Registering…' : 'Register to a customer' }}
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

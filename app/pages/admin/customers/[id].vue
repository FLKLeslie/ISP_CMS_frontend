<script setup lang="ts">
import type { MikroTikLease } from '~/types/api/microtik'

definePageMeta({ layout: 'admin' })
const route = useRoute()
const id = route.params.id as string
const { fetchCustomer, setCustomerStatus, updateCustomer, blockInternet } = useCustomersApi()
const { listSubscriptions } = useSubscriptionsApi()
const { listPayments } = usePaymentsApi()
const { listSuggestions } = useSuggestionsApi()
const { listLeases } = useMikroTikApi()
const { data: customer, pending, error, refresh } = await useAsyncData(`customer-${id}`, () => fetchCustomer(id))
const { data: subs, refresh: refreshSubs } = await useAsyncData(`customer-${id}-subs`, () => listSubscriptions({ customer: id }))
const { data: payments } = await useAsyncData(`customer-${id}-payments`, () => listPayments({ customer: id }))
const { data: suggestions } = await useAsyncData(`customer-${id}-suggestions`, () => listSuggestions({ customer: id }))
// This customer's devices as reported by whichever MikroTik each one sits
// behind. Block / Connect / Reallocate here go through the same shared
// controls as the MikroTik page, so both behave identically: a request
// leaves the device Pending until the MikroTik's next report confirms it.
const { data: leasesData, refresh: refreshLeases } = await useAsyncData(
  `customer-${id}-leases`, () => listLeases({ customer: id }),
)
const leases = computed(() => leasesData.value?.results ?? [])
const controls = useLeaseControls(() => refreshLeases())
const reallocatingLease = ref<MikroTikLease | null>(null)

// Let Pending settle on its own once the MikroTik reports back.
let leasePoller: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  leasePoller = setInterval(() => {
    if (!document.hidden && leases.value.some((l) => l.access_state === 'PENDING')) refreshLeases()
  }, 10_000)
})
onBeforeUnmount(() => clearInterval(leasePoller))

const subscriptionStatusLabel: Record<string, string> = { ACTIVE: 'Active', EXPIRED: 'Expired', CANCELLED: 'Blocked' }
const hasActiveSubscription = computed(() => subs.value?.results.some((s) => s.status === 'ACTIVE') ?? false)

// Suspend/reactivate the account (Customer.status). A suspended customer
// can still log in and look around, but every write action is blocked
// server-side - they're told to contact an administrator.
const confirmOpen = ref(false); const toggling = ref(false)
async function handleToggleStatus() {
  if (!customer.value) return
  toggling.value = true
  try { const next = customer.value.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'; customer.value = await setCustomerStatus(id, next) }
  finally { toggling.value = false; confirmOpen.value = false }
}

// Block internet access - distinct from suspending the account above.
// Deactivates their current active subscription; the customer can still
// log in, they just see their subscription as blocked. Always confirmed
// first, per the requirement that this never happens accidentally.
const confirmBlockOpen = ref(false); const blocking = ref(false); const blockError = ref('')
async function handleBlockInternet() {
  blocking.value = true; blockError.value = ''
  try { customer.value = await blockInternet(id); await Promise.all([refreshSubs(), refreshLeases()]) }
  catch { blockError.value = "Couldn't block internet access - please try again." }
  finally { blocking.value = false; confirmBlockOpen.value = false }
}

const editing = ref(false)
const form = reactive({
  first_name: '', last_name: '', email: '', phone_number: '',
  address: '', city: '', country: '', router_ip: '', router_mac_address: '', router_hostname: '',
})
const saving = ref(false)
function startEdit() {
  if (!customer.value) return
  form.first_name = customer.value.user.first_name
  form.last_name = customer.value.user.last_name
  form.email = customer.value.user.email
  form.phone_number = customer.value.user.phone_number
  form.address = customer.value.address
  form.city = customer.value.city
  form.country = customer.value.country
  form.router_ip = customer.value.router_ip ?? ''
  form.router_mac_address = customer.value.router_mac_address
  form.router_hostname = customer.value.router_hostname
  editing.value = true
}
async function handleSave() {
  saving.value = true
  try {
    customer.value = await updateCustomer(id, { ...form, router_ip: form.router_ip || null })
    editing.value = false
  } finally { saving.value = false }
}
</script>
<template>
  <div class="max-w-3xl space-y-6">
    <NuxtLink to="/admin/customers" class="text-sm text-text-secondary hover:text-text-primary">← Back to Customers</NuxtLink>
    <LoadingState v-if="pending" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <template v-else-if="customer">
      <div v-if="customer.status === 'SUSPENDED'" class="rounded-card border border-error/40 bg-error/5 p-3 text-sm text-error">
        This account is suspended. They can still log in, but can't make any changes until reactivated.
      </div>

      <div class="flex items-start justify-between gap-4 rounded-card border border-border bg-surface p-5">
        <div>
          <h1 class="text-xl font-semibold text-text-primary">{{ customer.user.first_name }} {{ customer.user.last_name }}</h1>
          <p class="text-sm text-text-secondary">{{ customer.user.email }} · {{ customer.user.phone_number || 'No phone on file' }}</p>
          <p class="mt-1 text-sm text-text-secondary">{{ [customer.address, customer.city, customer.country].filter(Boolean).join(', ') || 'No address on file' }}</p>
          <p class="mt-1 text-sm text-text-secondary">
            Router: <span class="font-mono text-xs">{{ customer.router_mac_address || 'MAC not set' }}</span>
            · {{ customer.router_ip || 'no IP' }}
            · {{ customer.router_hostname || 'no hostname' }}
          </p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <StatusBadge :label="customer.status === 'ACTIVE' ? 'Active' : 'Suspended'" :tone="customer.status === 'ACTIVE' ? 'success' : 'error'" />
          <button type="button" class="btn-secondary" @click="confirmOpen = true">
            {{ customer.status === 'ACTIVE' ? 'Suspend account' : 'Reactivate account' }}
          </button>
          <button type="button" class="btn-secondary" @click="startEdit">Edit details</button>
          <button v-if="hasActiveSubscription" type="button" class="btn-danger" @click="confirmBlockOpen = true">Block internet access</button>
        </div>
      </div>

      <form v-if="editing" class="grid grid-cols-1 gap-3 rounded-card border border-border bg-surface p-5 sm:grid-cols-2" @submit.prevent="handleSave">
        <p class="text-xs text-text-secondary sm:col-span-2">Only an administrator can change name, email, or phone number.</p>
        <input v-model="form.first_name" placeholder="First name" required class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <input v-model="form.last_name" placeholder="Last name" required class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <input v-model="form.email" type="email" placeholder="Email" required class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <input v-model="form.phone_number" placeholder="Phone number" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <input v-model="form.address" placeholder="Address" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <input v-model="form.city" placeholder="City" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <input v-model="form.country" placeholder="Country" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <input v-model="form.router_ip" placeholder="Router IP (optional)" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <input v-model="form.router_mac_address" placeholder="Router MAC address (links them to MikroTik reports)" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <input v-model="form.router_hostname" placeholder="Router hostname (optional)" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <div class="flex gap-2 sm:col-span-2">
          <button type="submit" :disabled="saving" class="btn-primary">{{ saving ? 'Saving…' : 'Save changes' }}</button>
          <button type="button" class="btn-secondary" @click="editing = false">Cancel</button>
        </div>
      </form>

      <p v-if="blockError" role="alert" class="rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">{{ blockError }}</p>

      <div class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-1 text-sm font-semibold text-text-primary">Internet Connection</h2>
        <p class="mb-3 text-xs text-text-secondary">
          Block or connect this customer's device directly. A change shows as Pending until the MikroTik confirms it.
        </p>
        <p v-if="controls.error.value" role="alert" class="mb-3 rounded-card border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{{ controls.error.value }}</p>
        <p v-if="controls.notice.value" role="status" class="mb-3 rounded-card border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">{{ controls.notice.value }}</p>
        <EmptyState
          v-if="!leases.length" title="No device allocated"
          description="No MikroTik device is allocated to this customer yet, so their connection can't be controlled from here. Allocate one from MikroTik Management → Needs allocation."
        >
          <template #action>
            <NuxtLink to="/admin/microtik?tab=unallocated" class="btn-secondary inline-block">Go to Needs allocation</NuxtLink>
          </template>
        </EmptyState>
        <MikroTikDeviceList
          v-else :leases="leases" :show-customer="false" cards-only :acting-id="controls.actingId.value"
          @block="controls.ask($event, 'block')" @connect="controls.ask($event, 'reconnect')"
          @allocate="reallocatingLease = $event" @reallocate="reallocatingLease = $event"
        />
      </div>

      <div class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Subscriptions</h2>
        <EmptyState v-if="!subs?.results.length" title="No subscriptions" />
        <DataTable v-else :columns="[{key:'plan',label:'Plan'},{key:'end_date',label:'Expires'},{key:'status',label:'Status'}]" :rows="subs.results" row-key="id">
          <template #cell-plan="{ row }">{{ row.plan.name }}</template>
          <template #cell-end_date="{ row }">{{ formatDate(row.end_date) }}</template>
          <template #cell-status="{ row }"><StatusBadge :label="subscriptionStatusLabel[row.status] ?? row.status" :tone="row.status === 'ACTIVE' ? 'success' : row.status === 'CANCELLED' ? 'error' : 'neutral'" /></template>
        </DataTable>
      </div>
      <div class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Payments</h2>
        <EmptyState v-if="!payments?.results.length" title="No payments" />
        <DataTable v-else :columns="[{key:'amount',label:'Amount'},{key:'method',label:'Method'},{key:'status',label:'Status'},{key:'date',label:'Date'}]" :rows="payments.results" row-key="id">
          <template #cell-amount="{ row }">{{ formatCurrency(row.amount) }}</template>
          <template #cell-method="{ row }">{{ row.payment_method }}</template>
          <template #cell-status="{ row }"><StatusBadge :label="row.status" :tone="row.status === 'COMPLETED' ? 'success' : 'neutral'" /></template>
          <template #cell-date="{ row }">{{ formatDate(row.payment_date) }}</template>
        </DataTable>
      </div>
      <div class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Suggestions</h2>
        <EmptyState v-if="!suggestions?.results.length" title="No suggestions submitted" />
        <ul v-else class="space-y-2">
          <li v-for="s in suggestions.results" :key="s.id" class="flex items-center justify-between border-b border-border pb-2 last:border-0">
            <span class="text-sm text-text-primary">{{ s.subject }}</span>
            <StatusBadge :label="s.status" tone="neutral" />
          </li>
        </ul>
      </div>
    </template>
    <ConfirmationDialog :open="confirmOpen" :title="customer?.status === 'ACTIVE' ? 'Suspend this account?' : 'Reactivate this account?'" description="A suspended customer can still log in, but can't make any changes until reactivated." :confirm-label="toggling ? 'Please wait…' : 'Confirm'" danger @confirm="handleToggleStatus" @cancel="confirmOpen = false" />
    <ConfirmationDialog
      :open="controls.dialog.value.open"
      :title="controls.dialog.value.title"
      :description="controls.dialog.value.description"
      :confirm-label="controls.dialog.value.confirmLabel"
      :danger="controls.dialog.value.danger"
      @confirm="controls.confirm()"
      @cancel="controls.cancel()"
    />
    <LeaseAllocationModal :lease="reallocatingLease" @close="reallocatingLease = null" @updated="refreshLeases()" />
    <ConfirmationDialog :open="confirmBlockOpen" title="Block this customer's internet access?" description="Their active subscription will be marked as blocked and they'll be alerted to contact you. A block command is also sent to their MikroTik device if one is allocated; it shows as Pending until the MikroTik confirms it (see MikroTik Management → Command history). This can't be undone from here." :confirm-label="blocking ? 'Please wait…' : 'Block internet access'" danger @confirm="handleBlockInternet" @cancel="confirmBlockOpen = false" />
  </div>
</template>
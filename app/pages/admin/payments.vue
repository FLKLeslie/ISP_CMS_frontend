<script setup lang="ts">
import { CreditCard } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

const { listPayments, recordPayment } = usePaymentsApi()
const { listCustomers } = useCustomersApi()
const { listSubscriptions } = useSubscriptionsApi()

// --- List / filter state -------------------------------------------------
const page = ref(1)
const statusFilter = ref('')
const methodFilter = ref('')

const listParams = computed(() => {
  const params: Record<string, string | number> = { page: page.value, page_size: 20 }
  if (statusFilter.value) params.status = statusFilter.value
  if (methodFilter.value) params.payment_method = methodFilter.value
  return params
})

const { data, pending, error, refresh } = await useAsyncData(
  'admin-payments',
  () => listPayments(listParams.value),
  { watch: [listParams] },
)
const payments = computed(() => data.value?.results ?? [])
const totalPages = computed(() => data.value?.total_pages ?? 1)

function statusTone(status: string) {
  if (status === 'COMPLETED') return 'success'
  if (status === 'PENDING') return 'warning'
  return 'error' // FAILED, CANCELLED
}

// --- Record-payment form ---------------------------------------------------
// Payments require a specific (customer, subscription) pair, so the form
// walks the admin through that in two steps: search+pick a customer, then
// pick from THAT customer's active subscriptions — rather than asking for
// raw UUIDs, which would be unusable in practice.
const showForm = ref(false)

const customerSearch = ref('')
const { data: customerResults } = await useAsyncData(
  'admin-payments-customer-search',
  () => customerSearch.value.length >= 2
    ? listCustomers({ search: customerSearch.value, page_size: 10 })
    : Promise.resolve(null),
  { watch: [customerSearch] },
)
const customerOptions = computed(() => customerResults.value?.results ?? [])
const selectedCustomerId = ref('')

// Once a customer is chosen, load THEIR active subscriptions so the admin
// can only ever pick a subscription that actually belongs to that customer
// (the backend also validates this — see PaymentWriteSerializer.validate —
// but surfacing only valid choices up front avoids a round-trip error).
const { data: subsForCustomer, refresh: refreshSubsForCustomer } = await useAsyncData(
  'admin-payments-customer-subs',
  () => selectedCustomerId.value
    ? listSubscriptions({ customer: selectedCustomerId.value, status: 'ACTIVE', page_size: 20 })
    : Promise.resolve(null),
  { watch: [selectedCustomerId] },
)
const subscriptionOptions = computed(() => subsForCustomer.value?.results ?? [])
const selectedSubscriptionId = ref('')
watch(selectedCustomerId, () => { selectedSubscriptionId.value = '' })

const amount = ref('')
const method = ref<'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY' | 'BANK'>('CASH')
const paymentDate = ref(new Date().toISOString().slice(0, 10))
const renewSubscription = ref(true)
const saving = ref(false)
const formError = ref('')

async function handleRecordPayment() {
  formError.value = ''
  if (!selectedCustomerId.value || !selectedSubscriptionId.value) {
    formError.value = 'Pick a customer and one of their active subscriptions first.'
    return
  }
  saving.value = true
  try {
    await recordPayment({
      subscription: selectedSubscriptionId.value,
      customer: selectedCustomerId.value,
      amount: amount.value,
      payment_method: method.value,
      status: 'COMPLETED',
      renew_subscription: renewSubscription.value,
    })
    // Reset the form back to a clean slate for the next entry.
    amount.value = ''
    selectedSubscriptionId.value = ''
    selectedCustomerId.value = ''
    customerSearch.value = ''
    showForm.value = false
    await refresh()
  } catch {
    formError.value = "Couldn't record this payment. Check the fields and try again."
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-text-primary">Payments</h1>
      <button
        type="button"
        class="rounded-card bg-secondary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        @click="showForm = !showForm"
      >
        {{ showForm ? 'Cancel' : 'Record Payment' }}
      </button>
    </div>

    <!-- Record-payment form -->
    <form
      v-if="showForm"
      class="space-y-4 rounded-card border border-border bg-surface p-5"
      @submit.prevent="handleRecordPayment"
    >
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

      <div v-if="selectedCustomerId">
        <label class="mb-1 block text-sm font-medium text-text-primary">Active subscription</label>
        <select
          v-model="selectedSubscriptionId"
          required
          class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        >
          <option value="" disabled>Select a subscription…</option>
          <option v-for="s in subscriptionOptions" :key="s.id" :value="s.id">
            {{ s.plan.name }} — expires {{ formatDate(s.end_date) }}
          </option>
        </select>
        <p v-if="!subscriptionOptions.length" class="mt-1 text-sm text-text-secondary">
          This customer has no active subscription to record a payment against.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Amount</label>
          <input
            v-model="amount"
            required
            type="number"
            step="0.01"
            min="0"
            class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Method</label>
          <select
            v-model="method"
            class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="CASH">Cash</option>
            <option value="MTN_MOMO">MTN MoMo</option>
            <option value="ORANGE_MONEY">Orange Money</option>
            <option value="BANK">Bank transfer</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Date</label>
          <input
            v-model="paymentDate"
            type="date"
            class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </div>
      </div>

      <label class="flex items-center gap-2 text-sm text-text-primary">
        <input v-model="renewSubscription" type="checkbox" class="rounded border-border" />
        Extend/renew this subscription from the payment
      </label>

      <p v-if="formError" role="alert" class="text-sm text-error">{{ formError }}</p>

      <button
        type="submit"
        :disabled="saving"
        class="rounded-card bg-secondary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {{ saving ? 'Recording…' : 'Record Payment' }}
      </button>
    </form>

    <!-- Filters -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <select
        v-model="statusFilter"
        class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option value="">All statuses</option>
        <option value="COMPLETED">Completed</option>
        <option value="PENDING">Pending</option>
        <option value="FAILED">Failed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      <select
        v-model="methodFilter"
        class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option value="">All methods</option>
        <option value="CASH">Cash</option>
        <option value="MTN_MOMO">MTN MoMo</option>
        <option value="ORANGE_MONEY">Orange Money</option>
        <option value="BANK">Bank transfer</option>
      </select>
    </div>

    <!-- List -->
    <LoadingState v-if="pending" :rows="6" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!payments.length" :icon="CreditCard" title="No payments found" />
    <template v-else>
      <DataTable
        :columns="[
          { key: 'customer', label: 'Customer' },
          { key: 'plan', label: 'Plan' },
          { key: 'amount', label: 'Amount' },
          { key: 'method', label: 'Method' },
          { key: 'date', label: 'Date' },
          { key: 'status', label: 'Status' },
        ]"
        :rows="payments"
        row-key="id"
      >
        <template #cell-customer="{ row }">
          <NuxtLink :to="`/admin/customers/${row.customer.id}`" class="hover:underline">
            {{ row.customer.user.first_name }} {{ row.customer.user.last_name }}
          </NuxtLink>
        </template>
        <template #cell-plan="{ row }">{{ row.subscription.plan.name }}</template>
        <template #cell-amount="{ row }">{{ formatCurrency(row.amount) }}</template>
        <template #cell-method="{ row }">{{ row.payment_method.replace('_', ' ') }}</template>
        <template #cell-date="{ row }">{{ formatDate(row.payment_date) }}</template>
        <template #cell-status="{ row }">
          <StatusBadge :label="row.status" :tone="statusTone(row.status)" />
        </template>
      </DataTable>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
  </div>
</template>
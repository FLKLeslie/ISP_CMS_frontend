<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const route = useRoute()
const id = route.params.id as string
const { fetchCustomer, setCustomerStatus } = useCustomersApi()
const { listSubscriptions } = useSubscriptionsApi()
const { listPayments } = usePaymentsApi()
const { listSuggestions } = useSuggestionsApi()
const { data: customer, pending, error, refresh } = await useAsyncData(`customer-${id}`, () => fetchCustomer(id))
const { data: subs } = await useAsyncData(`customer-${id}-subs`, () => listSubscriptions({ customer: id }))
const { data: payments } = await useAsyncData(`customer-${id}-payments`, () => listPayments({ customer: id }))
const { data: suggestions } = await useAsyncData(`customer-${id}-suggestions`, () => listSuggestions({ customer: id }))
const confirmOpen = ref(false); const toggling = ref(false)
async function handleToggleStatus() {
  if (!customer.value) return
  toggling.value = true
  try { const next = customer.value.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'; customer.value = await setCustomerStatus(id, next) }
  finally { toggling.value = false; confirmOpen.value = false }
}
</script>
<template>
  <div class="max-w-3xl space-y-6">
    <NuxtLink to="/admin/customers" class="text-sm text-text-secondary hover:text-text-primary">← Back to Customers</NuxtLink>
    <LoadingState v-if="pending" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <template v-else-if="customer">
      <div class="flex items-start justify-between gap-4 rounded-card border border-border bg-surface p-5">
        <div>
          <h1 class="text-xl font-semibold text-text-primary">{{ customer.user.first_name }} {{ customer.user.last_name }}</h1>
          <p class="text-sm text-text-secondary">{{ customer.user.email }} · {{ customer.user.phone_number || 'No phone on file' }}</p>
          <p class="mt-1 text-sm text-text-secondary">{{ [customer.address, customer.city, customer.country].filter(Boolean).join(', ') || 'No address on file' }}</p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <StatusBadge :label="customer.status" :tone="customer.status === 'ACTIVE' ? 'success' : 'error'" />
          <button type="button" class="rounded-card border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-text-secondary/10" @click="confirmOpen = true">
            {{ customer.status === 'ACTIVE' ? 'Suspend' : 'Reactivate' }}
          </button>
        </div>
      </div>
      <div class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Subscriptions</h2>
        <EmptyState v-if="!subs?.results.length" title="No subscriptions" />
        <DataTable v-else :columns="[{key:'plan',label:'Plan'},{key:'end_date',label:'Expires'},{key:'status',label:'Status'}]" :rows="subs.results" row-key="id">
          <template #cell-plan="{ row }">{{ row.plan.name }}</template>
          <template #cell-end_date="{ row }">{{ formatDate(row.end_date) }}</template>
          <template #cell-status="{ row }"><StatusBadge :label="row.status" :tone="row.status === 'ACTIVE' ? 'success' : 'neutral'" /></template>
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
    <ConfirmationDialog :open="confirmOpen" :title="customer?.status === 'ACTIVE' ? 'Suspend this customer?' : 'Reactivate this customer?'" description="This changes their account status immediately." :confirm-label="toggling ? 'Please wait…' : 'Confirm'" danger @confirm="handleToggleStatus" @cancel="confirmOpen = false" />
  </div>
</template>

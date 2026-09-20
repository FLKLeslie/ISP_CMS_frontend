<script setup lang="ts">
import { SUBSCRIPTION_STATUS_LABEL, type Plan, type SubscriptionStatus } from '~/types/api/subscriptions'
definePageMeta({ layout: 'admin' })
const { listPlans, createPlan } = usePlansApi()
const { listSubscriptions, grantSubscription } = useSubscriptionsApi()
const { listCustomers } = useCustomersApi()
const tab = ref<'subscriptions' | 'plans' | 'grant'>('subscriptions')
const page = ref(1); const statusFilter = ref('')
const subParams = computed(() => {
  const p: Record<string, string | number> = { page: page.value, page_size: 20 }
  if (statusFilter.value) p.status = statusFilter.value
  return p
})
const { data: subsData, pending: subsPending, error: subsError, refresh: refreshSubs } = await useAsyncData('admin-subs', () => listSubscriptions(subParams.value), { watch: [subParams] })
const { data: plansData, pending: plansPending, error: plansError, refresh: refreshPlans } = await useAsyncData('admin-plans', () => listPlans())
const subs = computed(() => subsData.value?.results ?? [])
const totalPages = computed(() => subsData.value?.total_pages ?? 1)
const plans = computed(() => plansData.value?.results ?? [])

// --- Plan creation (now supports GENERAL vs SPECIFIC plans) -------------
const showPlanForm = ref(false)
const planName = ref(''); const planDesc = ref(''); const planDuration = ref(30); const planPrice = ref('')
const planType = ref<'GENERAL' | 'SPECIFIC'>('GENERAL')
const planCustomerSearch = ref(''); const planCustomerIds = ref<string[]>([])
const planCustomerLabels = reactive<Record<string, string>>({})
const savingPlan = ref(false); const planError = ref('')
const { data: planCustomerResults } = await useAsyncData(
  'admin-plan-customer-search',
  () => planCustomerSearch.value.length >= 2 ? listCustomers({ search: planCustomerSearch.value, page_size: 10 }) : Promise.resolve(null),
  { watch: [planCustomerSearch] },
)
const planCustomerOptions = computed(() => (planCustomerResults.value?.results ?? []).filter((c) => !planCustomerIds.value.includes(c.id)))
function addPlanCustomer(id: string, label: string) {
  planCustomerIds.value.push(id); planCustomerLabels[id] = label; planCustomerSearch.value = ''
}
function removePlanCustomer(id: string) {
  planCustomerIds.value = planCustomerIds.value.filter((existing) => existing !== id)
}
async function handleCreatePlan() {
  planError.value = ''
  if (planType.value === 'SPECIFIC' && !planCustomerIds.value.length) {
    planError.value = 'Add at least one eligible customer for a specific plan.'
    return
  }
  savingPlan.value = true
  try {
    await createPlan({
      name: planName.value, description: planDesc.value, duration_days: planDuration.value,
      price: planPrice.value, is_active: true, plan_type: planType.value,
      eligible_customer_ids: planType.value === 'SPECIFIC' ? planCustomerIds.value : [],
    })
    planName.value = ''; planDesc.value = ''; planDuration.value = 30; planPrice.value = ''
    planType.value = 'GENERAL'; planCustomerIds.value = []; planCustomerSearch.value = ''
    showPlanForm.value = false
    await refreshPlans()
  } catch { planError.value = "Couldn't create the plan. Check the fields and try again." }
  finally { savingPlan.value = false }
}

// --- Plan details modal (edit/move-type/eligible-customers/delete) -----
const generalPlans = computed(() => plans.value.filter((p) => p.plan_type === 'GENERAL'))
const specificPlans = computed(() => plans.value.filter((p) => p.plan_type === 'SPECIFIC'))
const detailsPlan = ref<Plan | null>(null)
function handlePlanSaved(updated: Plan) {
  if (plansData.value) {
    const index = plansData.value.results.findIndex((p) => p.id === updated.id)
    if (index !== -1) plansData.value.results[index] = updated
  }
  detailsPlan.value = null
}
function handlePlanDeleted(planId: string) {
  if (plansData.value) plansData.value.results = plansData.value.results.filter((p) => p.id !== planId)
  detailsPlan.value = null
}

// --- Grant subscription (admin-recorded direct/cash payment) -----------
const grantCustomerSearch = ref(''); const grantCustomerId = ref('')
const grantPlanId = ref(''); const grantAmount = ref(''); const grantStartDate = ref('')
const granting = ref(false); const grantError = ref(''); const grantSuccess = ref(false)
const { data: grantCustomerResults } = await useAsyncData(
  'admin-grant-customer-search',
  () => grantCustomerSearch.value.length >= 2 ? listCustomers({ search: grantCustomerSearch.value, page_size: 10 }) : Promise.resolve(null),
  { watch: [grantCustomerSearch] },
)
const grantCustomerOptions = computed(() => grantCustomerResults.value?.results ?? [])
async function handleGrant() {
  grantError.value = ''; grantSuccess.value = false
  if (!grantCustomerId.value || !grantPlanId.value) { grantError.value = 'Pick a customer and a plan.'; return }
  granting.value = true
  try {
    await grantSubscription({
      customer: grantCustomerId.value, plan: grantPlanId.value,
      amount: grantAmount.value || undefined, start_date: grantStartDate.value || undefined,
    })
    grantSuccess.value = true
    grantCustomerId.value = ''; grantCustomerSearch.value = ''; grantPlanId.value = ''; grantAmount.value = ''; grantStartDate.value = ''
    await refreshSubs()
  } catch { grantError.value = "Couldn't grant this subscription. Check the fields and try again." }
  finally { granting.value = false }
}
</script>
<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">Subscriptions</h1>
    <div class="inline-flex rounded-card border border-border bg-surface p-0.5" role="tablist">
      <button v-for="t in [{key:'subscriptions',label:'Subscriptions'},{key:'plans',label:'Plans'},{key:'grant',label:'Grant Subscription'}]" :key="t.key" type="button"
        class="rounded-[0.4rem] px-4 py-1.5 text-sm font-medium transition-colors"
        :class="tab === t.key ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
        @click="tab = t.key as any">{{ t.label }}</button>
    </div>
    <div v-if="tab === 'subscriptions'" class="space-y-4">
      <select v-model="statusFilter" class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option><option value="CANCELLED">Blocked</option>
      </select>
      <LoadingState v-if="subsPending" :rows="6" />
      <ErrorState v-else-if="subsError" @retry="refreshSubs()" />
      <EmptyState v-else-if="!subs.length" title="No subscriptions found" />
      <template v-else>
        <DataTable :columns="[{key:'customer',label:'Customer'},{key:'plan',label:'Plan'},{key:'end_date',label:'Expires'},{key:'remaining',label:'Remaining'},{key:'status',label:'Status'},{key:'source',label:'Source'}]" :rows="subs" row-key="id">
          <template #cell-customer="{ row }"><NuxtLink :to="`/admin/customers/${row.customer.id}`" class="hover:underline">{{ row.customer.user.first_name }} {{ row.customer.user.last_name }}</NuxtLink></template>
          <template #cell-plan="{ row }">{{ row.plan.name }}</template>
          <template #cell-end_date="{ row }">{{ formatDate(row.end_date) }}</template>
          <template #cell-remaining="{ row }">{{ formatRemainingDays(row.remaining_days) }}</template>
          <template #cell-status="{ row }"><StatusBadge :label="SUBSCRIPTION_STATUS_LABEL[row.status as SubscriptionStatus] ?? row.status" :tone="row.status === 'ACTIVE' ? 'success' : row.status === 'EXPIRED' ? 'neutral' : 'error'" /></template>
          <template #cell-source="{ row }">{{ row.granted_by_name ? `Granted by ${row.granted_by_name}` : 'Customer purchase' }}</template>
        </DataTable>
        <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
      </template>
    </div>
    <div v-else-if="tab === 'plans'" class="space-y-4">
      <button type="button" class="btn-primary" @click="showPlanForm = !showPlanForm">{{ showPlanForm ? 'Cancel' : 'New Plan' }}</button>
      <form v-if="showPlanForm" class="grid grid-cols-1 gap-3 rounded-card border border-border bg-surface p-5 sm:grid-cols-2" @submit.prevent="handleCreatePlan">
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Name</label>
          <input v-model="planName" required class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Price</label>
          <input v-model="planPrice" required type="number" step="0.01" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Duration (days)</label>
          <input v-model.number="planDuration" required type="number" min="1" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Plan type</label>
          <select v-model="planType" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
            <option value="GENERAL">General - available to any customer</option>
            <option value="SPECIFIC">Specific - one customer only</option>
          </select>
        </div>
        <div v-if="planType === 'SPECIFIC'" class="space-y-2 sm:col-span-2">
          <label class="mb-1 block text-sm font-medium text-text-primary">Eligible customers</label>
          <ul v-if="planCustomerIds.length" class="space-y-1">
            <li v-for="id in planCustomerIds" :key="id" class="flex items-center justify-between text-sm">
              <span class="text-text-primary">{{ planCustomerLabels[id] }}</span>
              <button type="button" class="text-xs font-medium text-error hover:underline" @click="removePlanCustomer(id)">Remove</button>
            </li>
          </ul>
          <SearchInput v-model="planCustomerSearch" placeholder="Search by name or email…" />
          <div v-if="planCustomerOptions.length" class="mt-2 max-h-40 overflow-y-auto rounded-card border border-border">
            <button
              v-for="c in planCustomerOptions" :key="c.id" type="button"
              class="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-text-secondary/10"
              @click="addPlanCustomer(c.id, `${c.user.first_name} ${c.user.last_name} · ${c.user.email}`)">
              {{ c.user.first_name }} {{ c.user.last_name }} · {{ c.user.email }}
            </button>
          </div>
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-sm font-medium text-text-primary">Description</label>
          <textarea v-model="planDesc" rows="2" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <p v-if="planError" role="alert" class="text-sm text-error sm:col-span-2">{{ planError }}</p>
        <button type="submit" :disabled="savingPlan" class="btn-primary sm:col-span-2 sm:w-fit">{{ savingPlan ? 'Saving…' : 'Create Plan' }}</button>
      </form>
      <LoadingState v-if="plansPending" :rows="3" />
      <ErrorState v-else-if="plansError" @retry="refreshPlans()" />
      <EmptyState v-else-if="!plans.length" title="No plans yet" />
      <template v-else>
        <div class="space-y-6">
        <div>
          <h2 class="mb-3 text-sm font-semibold text-text-primary">General Plans</h2>
          <EmptyState v-if="!generalPlans.length" title="No general plans yet" />
          <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <PlanCard v-for="plan in generalPlans" :key="plan.id" :plan="plan" admin-mode @details="detailsPlan = $event" />
          </div>
        </div>
        <div>
          <h2 class="mb-3 text-sm font-semibold text-text-primary">Specific Plans</h2>
          <EmptyState v-if="!specificPlans.length" title="No customer-specific plans yet" />
          <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <PlanCard v-for="plan in specificPlans" :key="plan.id" :plan="plan" admin-mode @details="detailsPlan = $event" />
          </div>
        </div>
        </div>
      </template>
      <PlanDetailsModal :open="!!detailsPlan" :plan="detailsPlan" @close="detailsPlan = null" @saved="handlePlanSaved" @deleted="handlePlanDeleted" />
    </div>
    <div v-else class="max-w-lg space-y-4">
      <p class="text-sm text-text-secondary">
        Record a plan granted directly to a customer - e.g. a cash payment taken in person. This
        creates the subscription and a matching payment (method: Direct) exactly like a normal purchase.
      </p>
      <form class="grid grid-cols-1 gap-3 rounded-card border border-border bg-surface p-5" @submit.prevent="handleGrant">
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Customer</label>
          <SearchInput v-model="grantCustomerSearch" placeholder="Search by name or email…" />
          <div v-if="grantCustomerOptions.length" class="mt-2 max-h-40 overflow-y-auto rounded-card border border-border">
            <button
              v-for="c in grantCustomerOptions" :key="c.id" type="button"
              class="block w-full px-3 py-2 text-left text-sm hover:bg-text-secondary/10"
              :class="grantCustomerId === c.id ? 'bg-accent/10 text-accent' : 'text-text-primary'"
              @click="grantCustomerId = c.id; grantCustomerSearch = `${c.user.first_name} ${c.user.last_name}`">
              {{ c.user.first_name }} {{ c.user.last_name }} · {{ c.user.email }}
            </button>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Plan</label>
          <select v-model="grantPlanId" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
            <option value="" disabled>Select a plan…</option>
            <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }} ({{ formatCurrency(p.price) }})</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Amount (optional - defaults to plan price)</label>
          <input v-model="grantAmount" type="number" step="0.01" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-primary">Start date (optional - defaults to today)</label>
          <input v-model="grantStartDate" type="date" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <p v-if="grantError" role="alert" class="text-sm text-error">{{ grantError }}</p>
        <p v-if="grantSuccess" class="text-sm text-success">Subscription granted.</p>
        <button type="submit" :disabled="granting" class="btn-primary sm:w-fit">{{ granting ? 'Granting…' : 'Grant Subscription' }}</button>
      </form>
    </div>
  </div>
</template>

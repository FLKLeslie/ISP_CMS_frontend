<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const { listPlans, createPlan } = usePlansApi()
const { listSubscriptions } = useSubscriptionsApi()
const tab = ref<'subscriptions' | 'plans'>('subscriptions')
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
const showPlanForm = ref(false)
const planName = ref(''); const planDesc = ref(''); const planDuration = ref(30); const planPrice = ref('')
const savingPlan = ref(false); const planError = ref('')
async function handleCreatePlan() {
  planError.value = ''; savingPlan.value = true
  try {
    await createPlan({ name: planName.value, description: planDesc.value, duration_days: planDuration.value, price: planPrice.value, is_active: true })
    planName.value = ''; planDesc.value = ''; planDuration.value = 30; planPrice.value = ''
    showPlanForm.value = false
    await refreshPlans()
  } catch { planError.value = "Couldn't create the plan. Check the fields and try again." }
  finally { savingPlan.value = false }
}
</script>
<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">Subscriptions</h1>
    <div class="inline-flex rounded-card border border-border bg-surface p-0.5" role="tablist">
      <button v-for="t in [{key:'subscriptions',label:'Subscriptions'},{key:'plans',label:'Plans'}]" :key="t.key" type="button"
        class="rounded-[0.4rem] px-4 py-1.5 text-sm font-medium transition-colors"
        :class="tab === t.key ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
        @click="tab = t.key as any">{{ t.label }}</button>
    </div>
    <div v-if="tab === 'subscriptions'" class="space-y-4">
      <select v-model="statusFilter" class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option><option value="CANCELLED">Cancelled</option>
      </select>
      <LoadingState v-if="subsPending" :rows="6" />
      <ErrorState v-else-if="subsError" @retry="refreshSubs()" />
      <EmptyState v-else-if="!subs.length" title="No subscriptions found" />
      <template v-else>
        <DataTable :columns="[{key:'customer',label:'Customer'},{key:'plan',label:'Plan'},{key:'end_date',label:'Expires'},{key:'remaining',label:'Remaining'},{key:'status',label:'Status'}]" :rows="subs" row-key="id">
          <template #cell-customer="{ row }"><NuxtLink :to="`/admin/customers/${row.customer.id}`" class="hover:underline">{{ row.customer.user.first_name }} {{ row.customer.user.last_name }}</NuxtLink></template>
          <template #cell-plan="{ row }">{{ row.plan.name }}</template>
          <template #cell-end_date="{ row }">{{ formatDate(row.end_date) }}</template>
          <template #cell-remaining="{ row }">{{ formatRemainingDays(row.remaining_days) }}</template>
          <template #cell-status="{ row }"><StatusBadge :label="row.status" :tone="row.status === 'ACTIVE' ? 'success' : row.status === 'EXPIRED' ? 'neutral' : 'error'" /></template>
        </DataTable>
        <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
      </template>
    </div>
    <div v-else class="space-y-4">
      <button type="button" class="rounded-card bg-secondary px-4 py-2 text-sm font-semibold text-white hover:opacity-90" @click="showPlanForm = !showPlanForm">{{ showPlanForm ? 'Cancel' : 'New Plan' }}</button>
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
        <div class="sm:col-span-2">
          <label class="mb-1 block text-sm font-medium text-text-primary">Description</label>
          <textarea v-model="planDesc" rows="2" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <p v-if="planError" role="alert" class="text-sm text-error sm:col-span-2">{{ planError }}</p>
        <button type="submit" :disabled="savingPlan" class="rounded-card bg-secondary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 sm:col-span-2 sm:w-fit">{{ savingPlan ? 'Saving…' : 'Create Plan' }}</button>
      </form>
      <LoadingState v-if="plansPending" :rows="3" />
      <ErrorState v-else-if="plansError" @retry="refreshPlans()" />
      <EmptyState v-else-if="!plans.length" title="No plans yet" />
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PlanCard v-for="plan in plans" :key="plan.id" :plan="plan" admin-mode />
      </div>
    </div>
  </div>
</template>

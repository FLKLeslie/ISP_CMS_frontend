<script setup lang="ts">
definePageMeta({ layout: 'customer' })
const { listSubscriptions, purchasePlan } = useSubscriptionsApi()
const { listPlans } = usePlansApi()
const activeTab = ref<'current' | 'plans' | 'history'>('current')
const tabs: { key: typeof activeTab.value; label: string }[] = [{ key: 'current', label: 'Current' }, { key: 'plans', label: 'Plans' }, { key: 'history', label: 'History' }]
const { data: subscriptionsData, pending: subscriptionsPending, error: subscriptionsError, refresh: refreshSubscriptions } = await useAsyncData('customer-subscriptions', () => listSubscriptions({ ordering: '-created_at' }))
const { data: plansData, pending: plansPending, error: plansError, refresh: refreshPlans } = await useAsyncData('customer-plans', () => listPlans())
const subscriptions = computed(() => subscriptionsData.value?.results ?? [])
const currentSubscription = computed(() => subscriptions.value.find((s) => s.is_active) ?? null)
// No active subscription, but the most recent one was blocked (CANCELLED)
// rather than simply expired or never having existed - shown distinctly
// on the Current tab, matching the dashboard's "blocked" treatment.
const mostRecentSubscription = computed(() => subscriptions.value[0] ?? null)
const isBlocked = computed(() => !currentSubscription.value && mostRecentSubscription.value?.status === 'CANCELLED')
const plans = computed(() => plansData.value?.results.filter((p) => p.is_active) ?? [])
const purchaseError = ref(''); const purchasing = ref<string | null>(null)
const paymentMethod = ref<'MTN_MOMO' | 'ORANGE_MONEY'>('MTN_MOMO')
async function handleSelectPlan(planId: string) {
  purchaseError.value = ''; purchasing.value = planId
  try { await purchasePlan(planId, paymentMethod.value); await refreshSubscriptions(); activeTab.value = 'current' }
  catch (err: any) { purchaseError.value = err?.data?.detail || "Couldn't complete this purchase. Please try again." }
  finally { purchasing.value = null }
}
</script>
<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">Subscription</h1>
    <div class="inline-flex rounded-card border border-border bg-surface p-0.5" role="tablist">
      <button v-for="tab in tabs" :key="tab.key" type="button" role="tab" :aria-selected="activeTab === tab.key"
        class="rounded-[0.4rem] px-4 py-1.5 text-sm font-medium transition-colors"
        :class="activeTab === tab.key ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'" @click="activeTab = tab.key">
        {{ tab.label }}
      </button>
    </div>
    <div v-if="activeTab === 'current'">
      <LoadingState v-if="subscriptionsPending" />
      <ErrorState v-else-if="subscriptionsError" @retry="refreshSubscriptions()" />
      <SubscriptionCard
        v-else
        :plan-name="isBlocked ? mostRecentSubscription?.plan.name ?? null : (currentSubscription?.plan.name ?? null)"
        :remaining-days="currentSubscription?.remaining_days ?? 0"
        :expiry-date="currentSubscription?.end_date ?? null"
        :expires-at="currentSubscription?.expires_at ?? null"
        :duration-days="currentSubscription?.plan.duration_days"
        :blocked="isBlocked"
        @renew="activeTab = 'plans'"
      />
    </div>
    <div v-else-if="activeTab === 'plans'" class="space-y-4">
      <div class="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-4">
        <label for="payment_method" class="text-sm font-medium text-text-primary">Pay with</label>
        <select id="payment_method" v-model="paymentMethod" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
          <option value="MTN_MOMO">MTN MoMo</option>
          <option value="ORANGE_MONEY">Orange Money</option>
        </select>
      </div>
      <p v-if="purchaseError" role="alert" class="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{{ purchaseError }}</p>
      <LoadingState v-if="plansPending" :rows="3" />
      <ErrorState v-else-if="plansError" @retry="refreshPlans()" />
      <EmptyState v-else-if="!plans.length" title="No plans available right now" />
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <PlanCard v-for="plan in plans" :key="plan.id" :plan="plan" :current="currentSubscription?.plan.id === plan.id" @select="handleSelectPlan(plan.id)" />
      </div>
    </div>
    <div v-else class="space-y-3">
      <LoadingState v-if="subscriptionsPending" />
      <ErrorState v-else-if="subscriptionsError" @retry="refreshSubscriptions()" />
      <EmptyState v-else-if="!subscriptions.length" title="No subscription history yet" />
      <div v-else class="overflow-x-auto rounded-card border border-border bg-surface">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-border text-xs uppercase text-text-secondary">
            <tr><th class="px-4 py-3 font-medium">Plan</th><th class="px-4 py-3 font-medium">Start</th><th class="px-4 py-3 font-medium">End</th><th class="px-4 py-3 font-medium">Amount</th><th class="px-4 py-3 font-medium">Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="sub in subscriptions" :key="sub.id" class="border-b border-border last:border-0">
              <td class="px-4 py-3 text-text-primary">{{ sub.plan.name }}</td>
              <td class="px-4 py-3 text-text-secondary">{{ formatDate(sub.start_date) }}</td>
              <td class="px-4 py-3 text-text-secondary">{{ formatDate(sub.end_date) }}</td>
              <td class="px-4 py-3 text-text-secondary">{{ formatCurrency(sub.amount_paid) }}</td>
              <td class="px-4 py-3"><StatusBadge :label="sub.status === 'CANCELLED' ? 'Blocked' : sub.status" :tone="sub.status === 'ACTIVE' ? 'success' : sub.status === 'EXPIRED' ? 'neutral' : 'error'" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
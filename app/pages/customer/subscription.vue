<script setup lang="ts">
definePageMeta({ layout: 'customer' })

const { listSubscriptions, purchasePlan } = useSubscriptionsApi()
const { listPlans } = usePlansApi()

const activeTab = ref<'current' | 'plans' | 'history'>('current')
const tabs: { key: typeof activeTab.value; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'plans', label: 'Plans' },
  { key: 'history', label: 'History' },
]

const {
  data: subscriptionsData,
  pending: subscriptionsPending,
  error: subscriptionsError,
  refresh: refreshSubscriptions,
} = await useAsyncData('customer-subscriptions', () => listSubscriptions({ ordering: '-created_at' }))

const {
  data: plansData,
  pending: plansPending,
  error: plansError,
  refresh: refreshPlans,
} = await useAsyncData('customer-plans', () => listPlans())

const subscriptions = computed(() => subscriptionsData.value?.results ?? [])
const currentSubscription = computed(() => subscriptions.value.find((s) => s.is_active) ?? null)
const plans = computed(() => plansData.value?.results.filter((p) => p.is_active) ?? [])

const purchaseError = ref('')
const purchasing = ref<string | null>(null)

async function handleSelectPlan(planId: string) {
  purchaseError.value = ''
  purchasing.value = planId
  try {
    await purchasePlan(planId, 'MTN_MOMO')
    await refreshSubscriptions()
    activeTab.value = 'current'
  } catch {
    // Backend gap - see composables/api/useSubscriptionsApi.ts. Plain
    // language, not a raw 403/404, per the design spec.
    purchaseError.value =
      "Online plan purchases aren't available yet. Please contact an administrator to renew or change your plan."
  } finally {
    purchasing.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">Subscription</h1>

    <div class="inline-flex rounded-card border border-border bg-surface p-0.5" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.key"
        class="rounded-[0.4rem] px-4 py-1.5 text-sm font-medium transition-colors"
        :class="activeTab === tab.key ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Current -->
    <div v-if="activeTab === 'current'">
      <LoadingState v-if="subscriptionsPending" />
      <ErrorState v-else-if="subscriptionsError" @retry="refreshSubscriptions()" />
      <SubscriptionCard
        v-else
        :plan-name="currentSubscription?.plan.name ?? null"
        :remaining-days="currentSubscription?.remaining_days ?? 0"
        :expiry-date="currentSubscription?.end_date ?? null"
        @renew="activeTab = 'plans'"
      />
    </div>

    <!-- Plans -->
    <div v-else-if="activeTab === 'plans'" class="space-y-4">
      <p v-if="purchaseError" role="alert" class="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        {{ purchaseError }}
      </p>

      <LoadingState v-if="plansPending" :rows="3" />
      <ErrorState v-else-if="plansError" @retry="refreshPlans()" />
      <EmptyState v-else-if="!plans.length" title="No plans available right now" />
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PlanCard
          v-for="plan in plans"
          :key="plan.id"
          :plan="plan"
          :current="currentSubscription?.plan.id === plan.id"
          @select="handleSelectPlan(plan.id)"
        />
      </div>
    </div>

    <!-- History -->
    <div v-else class="space-y-3">
      <LoadingState v-if="subscriptionsPending" />
      <ErrorState v-else-if="subscriptionsError" @retry="refreshSubscriptions()" />
      <EmptyState v-else-if="!subscriptions.length" title="No subscription history yet" />
      <div v-else class="overflow-x-auto rounded-card border border-border bg-surface">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-border text-xs uppercase text-text-secondary">
            <tr>
              <th class="px-4 py-3 font-medium">Plan</th>
              <th class="px-4 py-3 font-medium">Start</th>
              <th class="px-4 py-3 font-medium">End</th>
              <th class="px-4 py-3 font-medium">Amount</th>
              <th class="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sub in subscriptions" :key="sub.id" class="border-b border-border last:border-0">
              <td class="px-4 py-3 text-text-primary">{{ sub.plan.name }}</td>
              <td class="px-4 py-3 text-text-secondary">{{ formatDate(sub.start_date) }}</td>
              <td class="px-4 py-3 text-text-secondary">{{ formatDate(sub.end_date) }}</td>
              <td class="px-4 py-3 text-text-secondary">{{ formatCurrency(sub.amount_paid) }}</td>
              <td class="px-4 py-3">
                <StatusBadge
                  :label="sub.status"
                  :tone="sub.status === 'ACTIVE' ? 'success' : sub.status === 'EXPIRED' ? 'neutral' : 'error'"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

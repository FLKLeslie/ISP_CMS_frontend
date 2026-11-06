<script setup lang="ts">
import { Clock, CreditCard, RadioTower, Router, TrendingUp, UserMinus, UserX, Users, Wifi } from 'lucide-vue-next'
definePageMeta({ layout: 'admin' })
import type { DashboardSection } from '~/types/api/admin-dashboard'
const { fetchAdminDashboard } = useDashboardApi()
const { data, pending, error, refresh } = await useAsyncData('admin-dashboard', () => fetchAdminDashboard())
const { canOpen } = usePermissions()
// The sections of the dashboard this account's permissions unlock (the server only fills these in).
const show = (section: DashboardSection) => !!data.value?.visible_sections.includes(section)
// A tile links to its page only if the account may open it; otherwise it's just a figure.
const linkIfOpen = (path: string) => (canOpen(path) ? path : undefined)
const subscriptionSeries = computed(() => !data.value ? [] : [data.value.active_subscriptions, data.value.expiring_soon, data.value.expired_subscriptions])
// Colour an "online / total" tile by how healthy it is: green when everything
// is up, amber when some are down, red when none are, neutral when there's
// nothing of that kind yet.
function ratioTone(online: number, total: number): 'primary' | 'success' | 'warning' | 'error' {
  if (total === 0) return 'primary'
  if (online === total) return 'success'
  return online === 0 ? 'error' : 'warning'
}
const suggestionStatusTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = { PENDING: 'neutral', REVIEWED: 'warning', RESPONDED: 'success', CLOSED: 'neutral' }
</script>
<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">Dashboard</h1>
    <LoadingState v-if="pending" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <template v-else-if="data">
      <!-- Each account sees only the sections its permissions unlock (the server only fills
           those in); anything else would be a misleading row of zeros. -->
      <EmptyState v-if="!data.visible_sections.length" title="Nothing to show here" description="Your account doesn't include any dashboard figures. Use the menu to open the areas you have access to." />

      <div v-if="show('customers') || show('subscriptions') || show('revenue')" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatSummaryCard v-if="show('customers')" label="Total Customers" :value="data.total_customers" :icon="Users" tone="primary" :to="linkIfOpen('/admin/customers')" />
        <StatSummaryCard v-if="show('subscriptions')" label="Active Subscriptions" :value="data.active_subscriptions" :icon="Wifi" tone="success" />
        <StatSummaryCard v-if="show('subscriptions')" label="Expiring Soon" :value="data.expiring_soon" :icon="Clock" tone="warning" />
        <StatSummaryCard v-if="show('customers')" label="Suspended Customers" :value="data.suspended_customers" :icon="UserX" tone="error" :to="linkIfOpen('/admin/customers?status=SUSPENDED')" />
        <StatSummaryCard v-if="show('revenue')" label="Revenue (This Year)" :value="formatCurrency(data.yearly_revenue)" :icon="TrendingUp" tone="accent" :to="linkIfOpen('/admin/revenue')" />
        <StatSummaryCard v-if="show('revenue')" label="Revenue (This Month)" :value="formatCurrency(data.monthly_revenue)" :icon="CreditCard" tone="accent" :to="linkIfOpen('/admin/revenue')" />
      </div>
      <div v-if="show('customers') || show('devices') || show('access_points') || show('microtik')" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatSummaryCard v-if="show('customers')" label="Customers Without a Plan" :value="data.customers_without_active_plan" :icon="UserMinus" tone="warning" />
        <StatSummaryCard v-if="show('devices')" label="Devices Online" :value="`${data.devices_online} / ${data.devices_total}`" :icon="Wifi" :tone="ratioTone(data.devices_online, data.devices_total)" :to="linkIfOpen('/admin/devices')" />
        <StatSummaryCard v-if="show('access_points')" label="Online APs" :value="`${data.access_points_online} / ${data.access_points_total}`" :icon="RadioTower" :tone="ratioTone(data.access_points_online, data.access_points_total)" :to="linkIfOpen('/admin/access-points')" />
        <StatSummaryCard v-if="show('microtik')" label="Online MikroTik Routers" :value="`${data.mikrotik_online} / ${data.mikrotik_total}`" :icon="Router" :tone="ratioTone(data.mikrotik_online, data.mikrotik_total)" :to="linkIfOpen('/admin/microtik')" />
      </div>
      <div v-if="show('subscriptions') || show('suggestions')" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div v-if="show('subscriptions')" class="rounded-card border border-border bg-surface p-5">
          <h2 class="mb-3 text-sm font-semibold text-text-primary">Subscriptions</h2>
          <DonutChart :series="subscriptionSeries" :labels="['Active', 'Expiring Soon', 'Expired']" :colors="['#16A34A', '#D97706', '#94A3B8']" />
        </div>
        <div v-if="show('suggestions')" class="rounded-card border border-border bg-surface p-5">
          <h2 class="mb-3 text-sm font-semibold text-text-primary">Latest Suggestions</h2>
          <EmptyState v-if="!data.latest_suggestions.length" title="Nothing to review" />
          <ul v-else class="space-y-3">
            <li v-for="suggestion in data.latest_suggestions" :key="suggestion.id" class="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
              <NuxtLink :to="`/admin/suggestions?highlight=${suggestion.id}`" class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-text-primary">{{ suggestion.subject }}</p>
                <p class="text-xs text-text-secondary">{{ formatRelativeTime(suggestion.created_at) }}</p>
              </NuxtLink>
              <StatusBadge :label="suggestion.status" :tone="suggestionStatusTone[suggestion.status] ?? 'neutral'" />
            </li>
          </ul>
        </div>
      </div>
      <div v-if="show('payments')" class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Recent Payments</h2>
        <EmptyState v-if="!data.recent_payments.length" title="No payments recorded yet" />
        <DataTable v-else :columns="[{key:'customer',label:'Customer'},{key:'amount',label:'Amount'},{key:'method',label:'Method'},{key:'status',label:'Status'},{key:'date',label:'Date'}]" :rows="data.recent_payments" row-key="id" @row-click="() => navigateTo('/admin/payments')">
          <template #cell-customer="{ row }">{{ row.customer.user.first_name }} {{ row.customer.user.last_name }}</template>
          <template #cell-amount="{ row }">{{ formatCurrency(row.amount) }}</template>
          <template #cell-method="{ row }">{{ row.payment_method }}</template>
          <template #cell-status="{ row }"><StatusBadge :label="row.status" :tone="row.status === 'COMPLETED' ? 'success' : row.status === 'FAILED' ? 'error' : 'neutral'" /></template>
          <template #cell-date="{ row }">{{ formatDate(row.payment_date) }}</template>
        </DataTable>
      </div>
    </template>
  </div>
</template>
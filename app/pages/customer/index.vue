<script setup lang="ts">
import { Bell, CreditCard, Wifi } from 'lucide-vue-next'
definePageMeta({ layout: 'customer' })
const { fetchCustomerDashboard } = useDashboardApi()
const { data, pending, error, refresh } = await useAsyncData('customer-dashboard', () => fetchCustomerDashboard())
</script>
<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">Dashboard</h1>
    <LoadingState v-if="pending" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <template v-else-if="data">
      <div v-if="data.account_status === 'SUSPENDED'" class="rounded-card border border-error/40 bg-error/5 p-3 text-sm text-error">
        Your account is suspended. Please contact an administrator to restore access.
      </div>
      <!-- Without a router linked to the account there's nothing to connect, so
           no plan can be bought: say so instead of leaving them to find out. -->
      <div v-if="!data.router_allocated" role="alert" class="rounded-card border border-warning/40 bg-warning/5 p-3">
        <p class="text-sm font-medium text-text-primary">Your router isn't linked to your account yet</p>
        <p class="mt-0.5 text-sm text-text-secondary">
          You can't purchase a plan or get internet until an administrator links your router. Please contact them —
          you'll get a notification as soon as it's done.
        </p>
      </div>
      <!-- Dashboard is a read-only summary - renewing/duplicating a plan
           happens on the Subscription page, not here. -->
      <SubscriptionCard
        :plan-name="data.is_blocked ? data.blocked_plan_name : (data.active_plan?.name ?? null)"
        :remaining-seconds="data.remaining_seconds"
        :expires-at="data.expires_at"
        :duration-minutes="data.active_plan?.duration_minutes"
        :blocked="data.is_blocked"
        :show-action="false"
        @expired="refresh()"
      />
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="flex items-center gap-3 rounded-card border border-border bg-surface p-4">
          <div class="flex h-10 w-10 items-center justify-center rounded-full" :class="data.is_blocked ? 'bg-error/10 text-error' : 'bg-success/10 text-success'"><Wifi class="h-5 w-5" aria-hidden="true" /></div>
          <div><p class="text-xs text-text-secondary">Service Status</p><p class="text-sm font-semibold text-text-primary">{{ data.is_blocked ? 'Blocked' : data.active_plan ? 'Online' : 'No Active Service' }}</p></div>
        </div>
        <NuxtLink to="/customer/subscription" class="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:border-secondary/40">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent"><CreditCard class="h-5 w-5" aria-hidden="true" /></div>
          <div><p class="text-xs text-text-secondary">Recent Payment</p><p class="text-sm font-semibold text-text-primary">{{ data.recent_payments[0] ? formatCurrency(data.recent_payments[0].amount) : 'None yet' }}</p></div>
        </NuxtLink>
        <NuxtLink to="/customer/notifications" class="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:border-secondary/40">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10 text-warning"><Bell class="h-5 w-5" aria-hidden="true" /></div>
          <div><p class="text-xs text-text-secondary">Unread Notifications</p><p class="text-sm font-semibold text-text-primary">{{ data.unread_notifications }}</p></div>
        </NuxtLink>
      </div>
      <div v-if="data.latest_announcements.length" class="rounded-card border border-border bg-surface p-5">
        <h2 class="mb-3 text-sm font-semibold text-text-primary">Service Announcements</h2>
        <ul class="space-y-3">
          <li v-for="announcement in data.latest_announcements" :key="announcement.id" class="border-b border-border pb-3 last:border-0 last:pb-0">
            <p class="text-sm font-medium text-text-primary">{{ announcement.title }}</p>
            <p class="text-sm text-text-secondary">{{ announcement.message }}</p>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
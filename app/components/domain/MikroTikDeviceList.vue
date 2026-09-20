<script setup lang="ts">
import type { MikroTikLease } from '~/types/api/microtik'

// Devices reported by MikroTiks. A table from `lg` up and a stack of cards
// below it, so nothing needs sideways scrolling on a phone or tablet. All
// state/action logic lives in AccessStateBadge and LeaseActions — this only
// lays them out — and it emits intent for the parent to act on.
withDefaults(defineProps<{
  leases: MikroTikLease[]
  actingId?: string | null
  showCustomer?: boolean
  // Always render cards, even on wide screens — for narrow containers
  // (e.g. a customer's page) where a multi-column table would be cramped.
  cardsOnly?: boolean
}>(), { actingId: null, showCustomer: true, cardsOnly: false })

const emit = defineEmits<{
  block: [lease: MikroTikLease]
  connect: [lease: MikroTikLease]
  allocate: [lease: MikroTikLease]
  reallocate: [lease: MikroTikLease]
  forget: [lease: MikroTikLease]
}>()

const columns = (showCustomer: boolean) => [
  { key: 'device', label: 'Device' },
  { key: 'ip', label: 'IP' },
  ...(showCustomer ? [{ key: 'customer', label: 'Customer' }] : []),
  { key: 'router', label: 'MikroTik' },
  { key: 'presence', label: 'Status' },
  { key: 'access', label: 'Access' },
  { key: 'actions', label: '' },
]
</script>

<template>
  <div>
    <!-- Large screens: table -->
    <div v-if="!cardsOnly" class="hidden lg:block">
      <DataTable :columns="columns(showCustomer)" :rows="leases" row-key="id">
        <template #cell-device="{ row }">
          <div class="font-medium">{{ row.hostname || 'Unnamed device' }}</div>
          <div class="font-mono text-xs text-text-secondary">{{ row.mac_address }}</div>
        </template>
        <template #cell-ip="{ row }">{{ row.ip_address || '—' }}</template>
        <template #cell-customer="{ row }">
          <NuxtLink v-if="row.customer" :to="`/admin/customers/${row.customer}`" class="hover:underline" @click.stop>
            {{ row.customer_name }}
          </NuxtLink>
          <span v-else class="text-warning">Not allocated</span>
        </template>
        <template #cell-router="{ row }">{{ row.router_identity || 'Unnamed MikroTik' }}</template>
        <template #cell-presence="{ row }">
          <span class="inline-flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full" :class="row.online ? 'bg-success' : 'bg-text-secondary/40'" aria-hidden="true" />
            {{ row.online ? 'Online' : 'Offline' }}
          </span>
          <div v-if="!row.online" class="text-xs text-text-secondary">Seen {{ formatRelativeTime(row.last_seen) }}</div>
        </template>
        <template #cell-access="{ row }">
          <AccessStateBadge :state="row.access_state" :pending-action="row.pending_action" />
        </template>
        <template #cell-actions="{ row }">
          <LeaseActions
            :lease="row" :busy="actingId === row.id"
            @allocate="emit('allocate', row as MikroTikLease)" @reallocate="emit('reallocate', row as MikroTikLease)"
            @block="emit('block', row as MikroTikLease)" @connect="emit('connect', row as MikroTikLease)"
            @forget="emit('forget', row as MikroTikLease)"
          />
        </template>
      </DataTable>
    </div>

    <!-- Small and medium screens: cards -->
    <ul class="space-y-3" :class="cardsOnly ? '' : 'lg:hidden'">
      <li v-for="lease in leases" :key="lease.id" class="rounded-card border border-border bg-surface p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate font-medium text-text-primary">{{ lease.hostname || 'Unnamed device' }}</p>
            <p class="break-all font-mono text-xs text-text-secondary">{{ lease.mac_address }}</p>
          </div>
          <AccessStateBadge :state="lease.access_state" :pending-action="lease.pending_action" class="shrink-0" />
        </div>

        <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div v-if="showCustomer" class="col-span-2">
            <dt class="text-xs text-text-secondary">Customer</dt>
            <dd class="text-text-primary">
              <NuxtLink v-if="lease.customer" :to="`/admin/customers/${lease.customer}`" class="hover:underline">{{ lease.customer_name }}</NuxtLink>
              <span v-else class="text-warning">Not allocated</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs text-text-secondary">IP</dt>
            <dd class="text-text-primary">{{ lease.ip_address || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-text-secondary">Status</dt>
            <dd class="text-text-primary">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full" :class="lease.online ? 'bg-success' : 'bg-text-secondary/40'" aria-hidden="true" />
                {{ lease.online ? 'Online' : `Offline · ${formatRelativeTime(lease.last_seen)}` }}
              </span>
            </dd>
          </div>
          <div class="col-span-2">
            <dt class="text-xs text-text-secondary">MikroTik</dt>
            <dd class="text-text-primary">{{ lease.router_identity || 'Unnamed MikroTik' }}</dd>
          </div>
        </dl>

        <div class="mt-4 border-t border-border pt-3">
          <LeaseActions
            :lease="lease" :busy="actingId === lease.id"
            @allocate="emit('allocate', lease)" @reallocate="emit('reallocate', lease)"
            @block="emit('block', lease)" @connect="emit('connect', lease)"
            @forget="emit('forget', lease)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>

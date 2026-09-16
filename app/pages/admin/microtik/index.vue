<script setup lang="ts">
import { Router } from 'lucide-vue-next'
import type { MikroTikRouter } from '~/types/api/microtik'

definePageMeta({ layout: 'admin' })

const { listRouters, listLeases, listCommands, approveRouter, rejectRouter, linkRouterToAccessPoint } = useMikroTikApi()
const { listAccessPointsWithLocation } = useAccessPointsApi()

const tab = ref<'routers' | 'leases' | 'commands'>('routers')

// --- Routers tab -----------------------------------------------------------
const routerStatusFilter = ref('')
const routerParams = computed(() => {
  const p: Record<string, string | number> = { page_size: 50 }
  if (routerStatusFilter.value) p.status = routerStatusFilter.value
  return p
})
const { data: routersData, pending: routersPending, error: routersError, refresh: refreshRouters } = await useAsyncData(
  'admin-microtik-routers', () => listRouters(routerParams.value), { watch: [routerParams] },
)
const routers = computed(() => routersData.value?.results ?? [])
const routerStatusTone = (status: string) =>
  status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : 'warning'

const { data: accessPointsData } = await useAsyncData('admin-microtik-aps', () => listAccessPointsWithLocation())
const accessPointOptions = computed(() => accessPointsData.value?.results ?? [])

const confirmAction = ref<{ router: MikroTikRouter; type: 'approve' | 'reject' } | null>(null)
const actingRouterId = ref<string | null>(null)
const actionError = ref('')

async function handleConfirmAction() {
  if (!confirmAction.value) return
  const { router, type } = confirmAction.value
  actingRouterId.value = router.id
  actionError.value = ''
  try {
    const updated = type === 'approve' ? await approveRouter(router.id) : await rejectRouter(router.id)
    const index = routersData.value?.results.findIndex((r) => r.id === router.id) ?? -1
    if (index !== -1 && routersData.value) routersData.value.results[index] = updated
  } catch (err) {
    actionError.value = apiErrorMessage(err, `Couldn't ${type} this router. Please try again.`)
  } finally {
    actingRouterId.value = null
    confirmAction.value = null
  }
}

const linkingRouterId = ref<string | null>(null)
async function handleLinkAccessPoint(router: MikroTikRouter, accessPointId: string) {
  linkingRouterId.value = router.id
  try {
    const updated = await linkRouterToAccessPoint(router.id, accessPointId || null)
    const index = routersData.value?.results.findIndex((r) => r.id === router.id) ?? -1
    if (index !== -1 && routersData.value) routersData.value.results[index] = updated
  } finally {
    linkingRouterId.value = null
  }
}

// --- Leases tab --------------------------------------------------------
const leaseSearch = ref('')
const leaseParams = computed(() => {
  const p: Record<string, string | number> = { page_size: 50, ordering: '-last_seen' }
  if (leaseSearch.value) p.search = leaseSearch.value
  return p
})
const { data: leasesData, pending: leasesPending, error: leasesError, refresh: refreshLeases } = await useAsyncData(
  'admin-microtik-leases', () => listLeases(leaseParams.value), { watch: [leaseParams] },
)
const leases = computed(() => leasesData.value?.results ?? [])

// --- Commands tab --------------------------------------------------------
const commandStatusFilter = ref('')
const commandParams = computed(() => {
  const p: Record<string, string | number> = { page_size: 50 }
  if (commandStatusFilter.value) p.status = commandStatusFilter.value
  return p
})
const { data: commandsData, pending: commandsPending, error: commandsError, refresh: refreshCommands } = await useAsyncData(
  'admin-microtik-commands', () => listCommands(commandParams.value), { watch: [commandParams] },
)
const commands = computed(() => commandsData.value?.results ?? [])
const commandStatusTone = (status: string) =>
  status === 'SENT' ? 'success' : status === 'FAILED' ? 'error' : 'neutral'
</script>
<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">MikroTik Routers</h1>
    <div class="inline-flex rounded-card border border-border bg-surface p-0.5" role="tablist">
      <button v-for="t in [{key:'routers',label:'Routers'},{key:'leases',label:'Leases'},{key:'commands',label:'Commands'}]" :key="t.key" type="button"
        class="rounded-[0.4rem] px-4 py-1.5 text-sm font-medium transition-colors"
        :class="tab === t.key ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
        @click="tab = t.key as any">{{ t.label }}</button>
    </div>

    <!-- Routers -->
    <div v-if="tab === 'routers'" class="space-y-4">
      <select v-model="routerStatusFilter" class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <option value="">All statuses</option>
        <option value="PENDING">Pending approval</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
      </select>
      <p v-if="actionError" role="alert" class="rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">{{ actionError }}</p>
      <LoadingState v-if="routersPending" :rows="4" />
      <ErrorState v-else-if="routersError" @retry="refreshRouters()" />
      <EmptyState v-else-if="!routers.length" :icon="Router" title="No MikroTik routers yet" description="Routers appear here automatically the first time they check in with the device-communication service." />
      <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div v-for="r in routers" :key="r.id" class="rounded-card border border-border bg-surface p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-medium text-text-primary">{{ r.identity || 'Unnamed router' }}</p>
              <p class="font-mono text-xs text-text-secondary">{{ r.signature }}</p>
              <p class="mt-1 text-xs text-text-secondary">{{ r.model || 'Unknown model' }}{{ r.firmware ? ` · v${r.firmware}` : '' }}</p>
            </div>
            <StatusBadge :label="r.status" :tone="routerStatusTone(r.status)" />
          </div>
          <p class="mt-2 text-xs text-text-secondary">
            {{ r.lease_count }} {{ r.lease_count === 1 ? 'lease' : 'leases' }} ·
            Last seen {{ r.last_seen_at ? formatRelativeTime(r.last_seen_at) : 'never' }}
          </p>

          <div class="mt-3">
            <label class="mb-1 block text-xs font-medium text-text-secondary">Linked access point</label>
            <select
              :value="r.access_point ?? ''" :disabled="linkingRouterId === r.id"
              class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              @change="handleLinkAccessPoint(r, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Not linked</option>
              <option v-for="ap in accessPointOptions" :key="ap.id" :value="ap.id">{{ ap.name }}</option>
            </select>
          </div>

          <div v-if="r.status === 'PENDING'" class="mt-3 flex gap-2">
            <button type="button" :disabled="actingRouterId === r.id" class="btn-primary flex-1" @click="confirmAction = { router: r, type: 'approve' }">Approve</button>
            <button type="button" :disabled="actingRouterId === r.id" class="btn-danger flex-1" @click="confirmAction = { router: r, type: 'reject' }">Reject</button>
          </div>
          <div v-else-if="r.status === 'APPROVED'" class="mt-3">
            <button type="button" :disabled="actingRouterId === r.id" class="btn-danger" @click="confirmAction = { router: r, type: 'reject' }">Revoke approval</button>
          </div>
          <div v-else class="mt-3">
            <button type="button" :disabled="actingRouterId === r.id" class="btn-secondary" @click="confirmAction = { router: r, type: 'approve' }">Approve anyway</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Leases -->
    <div v-else-if="tab === 'leases'" class="space-y-4">
      <SearchInput v-model="leaseSearch" placeholder="Search by MAC, hostname, or IP…" />
      <LoadingState v-if="leasesPending" :rows="5" />
      <ErrorState v-else-if="leasesError" @retry="refreshLeases()" />
      <EmptyState v-else-if="!leases.length" title="No leases reported yet" description="Leases appear here once an approved router starts reporting connected devices." />
      <DataTable
        v-else
        :columns="[{key:'mac',label:'MAC Address'},{key:'ip',label:'IP Address'},{key:'hostname',label:'Hostname'},{key:'router',label:'Router'},{key:'last_seen',label:'Last Seen'}]"
        :rows="leases" row-key="id"
      >
        <template #cell-mac="{ row }">
          <span class="font-mono">{{ row.mac_address }}</span>
        </template>
        <template #cell-ip="{ row }">{{ row.ip_address || '—' }}</template>
        <template #cell-hostname="{ row }">{{ row.hostname || '—' }}</template>
        <template #cell-router="{ row }">{{ row.router_identity || row.router_signature }}</template>
        <template #cell-last_seen="{ row }">{{ formatRelativeTime(row.last_seen) }}</template>
      </DataTable>
    </div>

    <!-- Commands -->
    <div v-else class="space-y-4">
      <p class="rounded-card border border-dashed border-warning/50 bg-warning/5 p-3 text-sm text-text-primary">
        <span class="font-semibold text-warning">Sent isn't the same as confirmed.</span>
        The MikroTik router has no way to report back that it actually applied a command — "Sent" only means
        the device-communication service accepted it for delivery on the router's next check-in.
      </p>
      <select v-model="commandStatusFilter" class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <option value="">All statuses</option>
        <option value="PENDING">Pending</option>
        <option value="SENT">Sent</option>
        <option value="FAILED">Failed</option>
      </select>
      <LoadingState v-if="commandsPending" :rows="5" />
      <ErrorState v-else-if="commandsError" @retry="refreshCommands()" />
      <EmptyState v-else-if="!commands.length" title="No commands sent yet" />
      <DataTable
        v-else
        :columns="[{key:'mac',label:'MAC Address'},{key:'command_type',label:'Command'},{key:'customer',label:'Customer'},{key:'router',label:'Router'},{key:'status',label:'Status'},{key:'created_at',label:'When'}]"
        :rows="commands" row-key="id"
      >
        <template #cell-mac="{ row }"><span class="font-mono">{{ row.mac_address }}</span></template>
        <template #cell-command_type="{ row }">{{ row.command_type === 'block' ? 'Block' : 'Reconnect' }}</template>
        <template #cell-customer="{ row }">{{ row.customer_name || '—' }}</template>
        <template #cell-router="{ row }">{{ row.router_signature }}</template>
        <template #cell-status="{ row }"><StatusBadge :label="row.status" :tone="commandStatusTone(row.status)" /></template>
        <template #cell-created_at="{ row }">{{ formatRelativeTime(row.created_at) }}</template>
      </DataTable>
    </div>

    <ConfirmationDialog
      :open="!!confirmAction"
      :title="confirmAction?.type === 'approve' ? 'Approve this router?' : 'Reject this router?'"
      :description="confirmAction?.type === 'approve'
        ? 'The device-communication service will start accepting block/reconnect traffic for this router.'
        : 'The device-communication service will stop accepting anything from this router until it\'s approved again.'"
      :confirm-label="actingRouterId ? 'Please wait…' : 'Confirm'"
      :danger="confirmAction?.type === 'reject'"
      @confirm="handleConfirmAction"
      @cancel="confirmAction = null"
    />
  </div>
</template>

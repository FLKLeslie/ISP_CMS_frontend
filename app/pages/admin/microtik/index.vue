<script setup lang="ts">
import { Router } from 'lucide-vue-next'
import type { MikroTikLease, MikroTikRouter } from '~/types/api/microtik'

definePageMeta({ layout: 'admin' })

const {
  listRouters, listLeases, listCommands,
  approveRouter, rejectRouter, linkRouterToAccessPoint,
  allocateLease, blockLease, reconnectLease,
} = useMikroTikApi()
const { listAccessPointsWithLocation } = useAccessPointsApi()
const { listCustomers } = useCustomersApi()

const tab = ref<'routers' | 'unallocated' | 'commands'>('routers')

// --- Routers + their connected client routers -----------------------------
const { data: routersData, pending: routersPending, error: routersError, refresh: refreshRouters } = await useAsyncData(
  'admin-microtik-routers', () => listRouters({ page_size: 50 }),
)
const routers = computed(() => routersData.value?.results ?? [])

// All leases in one fetch, then grouped by router client-side - far fewer
// round trips than one request per router, and the volume here (client
// routers behind an institution's MikroTiks) is small enough that paging
// per-router would be more machinery than it's worth.
const { data: leasesData, pending: leasesPending, refresh: refreshLeases } = await useAsyncData(
  'admin-microtik-leases', () => listLeases({ page_size: 200, ordering: '-last_seen' }),
)
const allLeases = computed(() => leasesData.value?.results ?? [])
const leasesByRouter = computed(() => {
  const grouped: Record<string, MikroTikLease[]> = {}
  for (const lease of allLeases.value) {
    ;(grouped[lease.router] ??= []).push(lease)
  }
  return grouped
})
const unallocatedLeases = computed(() => allLeases.value.filter((l) => !l.is_allocated))

const { data: accessPointsData } = await useAsyncData('admin-microtik-aps', () => listAccessPointsWithLocation())
const accessPointOptions = computed(() => accessPointsData.value?.results ?? [])

const routerStatusTone = (status: string) =>
  status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : 'warning'
const accessStateTone = (state: string) =>
  state === 'ALLOWED' ? 'success' : state === 'BLOCKED' ? 'error' : 'neutral'
const accessStateLabel = (state: string) =>
  state === 'ALLOWED' ? 'Allowed' : state === 'BLOCKED' ? 'Blocked' : 'Not set'

const actionError = ref('')

// --- Approve / reject a MikroTik ------------------------------------------
const confirmRouterAction = ref<{ router: MikroTikRouter; type: 'approve' | 'reject' } | null>(null)
const actingRouterId = ref<string | null>(null)
async function handleConfirmRouterAction() {
  if (!confirmRouterAction.value) return
  const { router, type } = confirmRouterAction.value
  actingRouterId.value = router.id
  actionError.value = ''
  try {
    const updated = type === 'approve' ? await approveRouter(router.id) : await rejectRouter(router.id)
    const index = routersData.value?.results.findIndex((r) => r.id === router.id) ?? -1
    if (index !== -1 && routersData.value) routersData.value.results[index] = updated
  } catch (err) {
    actionError.value = apiErrorMessage(err, `Couldn't ${type} this MikroTik. Please try again.`)
  } finally {
    actingRouterId.value = null
    confirmRouterAction.value = null
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

// --- Block / reconnect one client router ----------------------------------
const confirmLeaseAction = ref<{ lease: MikroTikLease; type: 'block' | 'reconnect' } | null>(null)
const actingLeaseId = ref<string | null>(null)
function replaceLease(updated: MikroTikLease) {
  const index = leasesData.value?.results.findIndex((l) => l.id === updated.id) ?? -1
  if (index !== -1 && leasesData.value) leasesData.value.results[index] = updated
}
async function handleConfirmLeaseAction() {
  if (!confirmLeaseAction.value) return
  const { lease, type } = confirmLeaseAction.value
  actingLeaseId.value = lease.id
  actionError.value = ''
  try {
    const result = type === 'block' ? await blockLease(lease.id) : await reconnectLease(lease.id)
    replaceLease(result.lease)
    if (result.command.status === 'FAILED') {
      actionError.value = result.command.error_message
        || `The ${type} request couldn't be delivered to the MikroTik. Check the Commands tab.`
    }
  } catch (err) {
    actionError.value = apiErrorMessage(err, `Couldn't ${type} this router. Please try again.`)
  } finally {
    actingLeaseId.value = null
    confirmLeaseAction.value = null
  }
}

// --- Allocate an unmatched client router to a customer --------------------
const allocatingLease = ref<MikroTikLease | null>(null)
const customerSearch = ref('')
const allocating = ref(false)
const { data: customerResults } = await useAsyncData(
  'admin-microtik-customer-search',
  () => customerSearch.value.length >= 2 ? listCustomers({ search: customerSearch.value, page_size: 10 }) : Promise.resolve(null),
  { watch: [customerSearch] },
)
const customerOptions = computed(() => customerResults.value?.results ?? [])
async function handleAllocate(customerId: string) {
  if (!allocatingLease.value) return
  allocating.value = true
  actionError.value = ''
  try {
    const updated = await allocateLease(allocatingLease.value.id, customerId)
    replaceLease(updated)
    allocatingLease.value = null
    customerSearch.value = ''
  } catch (err) {
    actionError.value = apiErrorMessage(err, "Couldn't allocate this router. Please try again.")
  } finally {
    allocating.value = false
  }
}

// --- Command history ------------------------------------------------------
const { data: commandsData, pending: commandsPending, error: commandsError, refresh: refreshCommands } = await useAsyncData(
  'admin-microtik-commands', () => listCommands({ page_size: 50 }),
)
const commands = computed(() => commandsData.value?.results ?? [])
const commandStatusTone = (status: string) =>
  status === 'SENT' ? 'success' : status === 'FAILED' ? 'error' : 'neutral'
</script>
<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-text-primary">MikroTik Management</h1>
      <button type="button" class="btn-secondary" @click="refreshRouters(); refreshLeases()">Refresh</button>
    </div>

    <div class="inline-flex rounded-card border border-border bg-surface p-0.5" role="tablist">
      <button
        v-for="t in [
          { key: 'routers', label: 'MikroTiks & Devices' },
          { key: 'unallocated', label: `Needs Allocation${unallocatedLeases.length ? ` (${unallocatedLeases.length})` : ''}` },
          { key: 'commands', label: 'Command History' },
        ]"
        :key="t.key" type="button"
        class="rounded-[0.4rem] px-4 py-1.5 text-sm font-medium transition-colors"
        :class="tab === t.key ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
        @click="tab = t.key as any"
      >{{ t.label }}</button>
    </div>

    <p v-if="actionError" role="alert" class="rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">{{ actionError }}</p>

    <!-- MikroTiks, each with the client routers connected to it -->
    <div v-if="tab === 'routers'" class="space-y-5">
      <LoadingState v-if="routersPending || leasesPending" :rows="5" />
      <ErrorState v-else-if="routersError" @retry="refreshRouters()" />
      <EmptyState
        v-else-if="!routers.length" :icon="Router" title="No MikroTiks yet"
        description="A MikroTik appears here automatically the first time it checks in with the device-communication service."
      />
      <div v-else v-for="r in routers" :key="r.id" class="rounded-card border border-border bg-surface">
        <!-- MikroTik header -->
        <div class="border-b border-border p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="font-medium text-text-primary">{{ r.identity || 'Unnamed MikroTik' }}</p>
              <p class="font-mono text-xs text-text-secondary">{{ r.signature }}</p>
              <p class="mt-1 text-xs text-text-secondary">
                {{ r.model || 'Unknown model' }}{{ r.firmware ? ` · v${r.firmware}` : '' }} ·
                Last seen {{ r.last_seen_at ? formatRelativeTime(r.last_seen_at) : 'never' }}
              </p>
            </div>
            <div class="flex flex-col items-end gap-2">
              <StatusBadge :label="r.status" :tone="routerStatusTone(r.status)" />
              <div v-if="r.status === 'PENDING'" class="flex gap-2">
                <button type="button" :disabled="actingRouterId === r.id" class="btn-primary" @click="confirmRouterAction = { router: r, type: 'approve' }">Approve</button>
                <button type="button" :disabled="actingRouterId === r.id" class="btn-danger" @click="confirmRouterAction = { router: r, type: 'reject' }">Reject</button>
              </div>
              <button v-else-if="r.status === 'APPROVED'" type="button" :disabled="actingRouterId === r.id" class="btn-danger" @click="confirmRouterAction = { router: r, type: 'reject' }">Revoke approval</button>
              <button v-else type="button" :disabled="actingRouterId === r.id" class="btn-secondary" @click="confirmRouterAction = { router: r, type: 'approve' }">Approve anyway</button>
            </div>
          </div>
          <div class="mt-3 max-w-xs">
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
        </div>

        <!-- Client routers connected to THIS MikroTik -->
        <div class="p-4">
          <h3 class="mb-2 text-sm font-semibold text-text-primary">
            Connected client routers
            <span class="font-normal text-text-secondary">({{ (leasesByRouter[r.id] ?? []).length }})</span>
          </h3>
          <EmptyState v-if="!(leasesByRouter[r.id] ?? []).length" title="Nothing reported yet" description="Client routers appear here once this MikroTik starts reporting them." />
          <DataTable
            v-else
            :columns="[
              { key: 'mac', label: 'MAC Address' },
              { key: 'ip', label: 'IP' },
              { key: 'hostname', label: 'Hostname' },
              { key: 'customer', label: 'Customer' },
              { key: 'access', label: 'Access' },
              { key: 'actions', label: '' },
            ]"
            :rows="leasesByRouter[r.id] ?? []" row-key="id"
          >
            <template #cell-mac="{ row }"><span class="font-mono text-xs">{{ row.mac_address }}</span></template>
            <template #cell-ip="{ row }">{{ row.ip_address || '—' }}</template>
            <template #cell-hostname="{ row }">{{ row.hostname || '—' }}</template>
            <template #cell-customer="{ row }">
              <NuxtLink v-if="row.customer" :to="`/admin/customers/${row.customer}`" class="hover:underline">{{ row.customer_name }}</NuxtLink>
              <span v-else class="text-warning">Not allocated</span>
            </template>
            <template #cell-access="{ row }">
              <StatusBadge :label="accessStateLabel(row.access_state)" :tone="accessStateTone(row.access_state)" />
            </template>
            <template #cell-actions="{ row }">
              <div class="flex justify-end gap-2">
                <button v-if="!row.is_allocated" type="button" class="text-xs font-medium text-secondary hover:underline" @click.stop="allocatingLease = row; customerSearch = ''">Allocate</button>
                <button v-if="row.access_state !== 'BLOCKED'" type="button" :disabled="actingLeaseId === row.id" class="text-xs font-medium text-error hover:underline" @click.stop="confirmLeaseAction = { lease: row, type: 'block' }">Block</button>
                <button v-if="row.access_state !== 'ALLOWED'" type="button" :disabled="actingLeaseId === row.id" class="text-xs font-medium text-success hover:underline" @click.stop="confirmLeaseAction = { lease: row, type: 'reconnect' }">Reconnect</button>
              </div>
            </template>
          </DataTable>
        </div>
      </div>
    </div>

    <!-- Client routers not yet matched to a customer -->
    <div v-else-if="tab === 'unallocated'" class="space-y-4">
      <p class="text-sm text-text-secondary">
        Client routers a MikroTik can see but that aren't matched to any customer yet. Allocating one records its
        MAC address against that customer, so every future report matches them automatically.
      </p>
      <LoadingState v-if="leasesPending" :rows="4" />
      <EmptyState v-else-if="!unallocatedLeases.length" title="Everything is allocated" description="Every client router currently reported is matched to a customer." />
      <DataTable
        v-else
        :columns="[
          { key: 'mac', label: 'MAC Address' },
          { key: 'ip', label: 'IP' },
          { key: 'hostname', label: 'Hostname' },
          { key: 'router', label: 'Behind MikroTik' },
          { key: 'last_seen', label: 'Last Seen' },
          { key: 'actions', label: '' },
        ]"
        :rows="unallocatedLeases" row-key="id"
      >
        <template #cell-mac="{ row }"><span class="font-mono text-xs">{{ row.mac_address }}</span></template>
        <template #cell-ip="{ row }">{{ row.ip_address || '—' }}</template>
        <template #cell-hostname="{ row }">{{ row.hostname || '—' }}</template>
        <template #cell-router="{ row }">{{ row.router_identity || row.router_signature }}</template>
        <template #cell-last_seen="{ row }">{{ formatRelativeTime(row.last_seen) }}</template>
        <template #cell-actions="{ row }">
          <button type="button" class="text-xs font-medium text-secondary hover:underline" @click.stop="allocatingLease = row; customerSearch = ''">Allocate to customer</button>
        </template>
      </DataTable>
    </div>

    <!-- Command history -->
    <div v-else class="space-y-4">
      <p class="rounded-card border border-dashed border-warning/50 bg-warning/5 p-3 text-sm text-text-primary">
        <span class="font-semibold text-warning">"Sent" isn't the same as "confirmed".</span>
        A MikroTik has no way to report back that it actually applied a command — "Sent" only means the
        device-communication service accepted it for delivery on that MikroTik's next check-in.
      </p>
      <LoadingState v-if="commandsPending" :rows="5" />
      <ErrorState v-else-if="commandsError" @retry="refreshCommands()" />
      <EmptyState v-else-if="!commands.length" title="No commands sent yet" />
      <DataTable
        v-else
        :columns="[
          { key: 'mac', label: 'MAC Address' },
          { key: 'command_type', label: 'Command' },
          { key: 'customer', label: 'Customer' },
          { key: 'router', label: 'Via MikroTik' },
          { key: 'status', label: 'Status' },
          { key: 'created_at', label: 'When' },
        ]"
        :rows="commands" row-key="id"
      >
        <template #cell-mac="{ row }"><span class="font-mono text-xs">{{ row.mac_address }}</span></template>
        <template #cell-command_type="{ row }">{{ row.command_type === 'block' ? 'Block' : 'Reconnect' }}</template>
        <template #cell-customer="{ row }">{{ row.customer_name || '—' }}</template>
        <template #cell-router="{ row }"><span class="font-mono text-xs">{{ row.router_signature }}</span></template>
        <template #cell-status="{ row }"><StatusBadge :label="row.status" :tone="commandStatusTone(row.status)" /></template>
        <template #cell-created_at="{ row }">{{ formatRelativeTime(row.created_at) }}</template>
      </DataTable>
    </div>

    <!-- Allocation picker -->
    <div v-if="allocatingLease" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" @mousedown.self="allocatingLease = null">
      <div class="w-full max-w-md rounded-card border border-border bg-surface p-5 shadow-xl" role="dialog" aria-modal="true">
        <h2 class="text-base font-semibold text-text-primary">Allocate this router</h2>
        <p class="mt-1 font-mono text-xs text-text-secondary">{{ allocatingLease.mac_address }}</p>
        <p class="mt-2 text-sm text-text-secondary">
          The customer's router details will be updated to match, so future reports for this router are
          recognised automatically.
        </p>
        <div class="mt-4">
          <SearchInput v-model="customerSearch" placeholder="Search customers by name or email…" />
          <div v-if="customerOptions.length" class="mt-2 max-h-56 overflow-y-auto rounded-card border border-border">
            <button
              v-for="c in customerOptions" :key="c.id" type="button" :disabled="allocating"
              class="block w-full px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-text-secondary/10 disabled:opacity-50"
              @click="handleAllocate(c.id)"
            >
              {{ c.user.first_name }} {{ c.user.last_name }} · {{ c.user.email }}
            </button>
          </div>
        </div>
        <div class="mt-4 flex justify-end">
          <button type="button" class="btn-secondary" @click="allocatingLease = null">Cancel</button>
        </div>
      </div>
    </div>

    <ConfirmationDialog
      :open="!!confirmRouterAction"
      :title="confirmRouterAction?.type === 'approve' ? 'Approve this MikroTik?' : 'Reject this MikroTik?'"
      :description="confirmRouterAction?.type === 'approve'
        ? 'It will start being accepted as a known MikroTik, and Django will act on the client routers it reports.'
        : 'It will stop being accepted until approved again — reports from it will be refused.'"
      :confirm-label="actingRouterId ? 'Please wait…' : 'Confirm'"
      :danger="confirmRouterAction?.type === 'reject'"
      @confirm="handleConfirmRouterAction"
      @cancel="confirmRouterAction = null"
    />
    <ConfirmationDialog
      :open="!!confirmLeaseAction"
      :title="confirmLeaseAction?.type === 'block' ? 'Block this router\'s internet?' : 'Restore this router\'s internet?'"
      :description="confirmLeaseAction?.type === 'block'
        ? 'A block command is sent to the MikroTik this router sits behind. The MikroTik can\'t confirm it applied the change — check Command History for the outcome.'
        : 'A reconnect command is sent to the MikroTik this router sits behind. The MikroTik can\'t confirm it applied the change — check Command History for the outcome.'"
      :confirm-label="actingLeaseId ? 'Please wait…' : 'Confirm'"
      :danger="confirmLeaseAction?.type === 'block'"
      @confirm="handleConfirmLeaseAction"
      @cancel="confirmLeaseAction = null"
    />
  </div>
</template>

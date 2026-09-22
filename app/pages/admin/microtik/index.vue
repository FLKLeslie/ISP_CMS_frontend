<script setup lang="ts">
import { Router, Trash2, Wifi, WifiOff, UserX } from 'lucide-vue-next'
import type { MikroTikCommand, MikroTikLease, MikroTikRouter } from '~/types/api/microtik'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const {
  listRouters, listLeases, getLeaseSummary, listCommands,
  approveRouter, rejectRouter, linkRouterToAccessPoint,
  forgetLease, deleteCommand, clearCommands,
} = useMikroTikApi()
const { listAccessPointsWithLocation } = useAccessPointsApi()

// --- Tabs -----------------------------------------------------------------
// MikroTiks    the routers themselves (approve / reject / link to an AP)
// Online       devices a MikroTik currently sees
// Offline      devices a MikroTik has seen before but doesn't right now —
//              they stay on record and keep their customer
// Needs allocation  devices not matched to any customer (online or not)
// Commands     audit trail of every block / connect
type Tab = 'routers' | 'online' | 'offline' | 'unallocated' | 'commands'
const TAB_KEYS: Tab[] = ['routers', 'online', 'offline', 'unallocated', 'commands']
const tab = ref<Tab>(TAB_KEYS.includes(route.query.tab as Tab) ? (route.query.tab as Tab) : 'routers')
const isDeviceTab = computed(() => tab.value === 'online' || tab.value === 'offline' || tab.value === 'unallocated')

// --- Counts for the tab badges --------------------------------------------
const { data: summary, refresh: refreshSummary } = await useAsyncData('admin-microtik-summary', () => getLeaseSummary())

const tabs = computed(() => [
  { key: 'routers' as Tab, label: 'MikroTiks', count: undefined as number | undefined },
  { key: 'online' as Tab, label: 'Online', count: summary.value?.online },
  { key: 'offline' as Tab, label: 'Offline', count: summary.value?.offline },
  { key: 'unallocated' as Tab, label: 'Needs allocation', count: summary.value?.unallocated },
  { key: 'commands' as Tab, label: 'Command history', count: undefined as number | undefined },
])

// --- MikroTiks --------------------------------------------------------------
const { data: routersData, pending: routersPending, error: routersError, refresh: refreshRouters } = await useAsyncData(
  'admin-microtik-routers', () => listRouters({ page_size: 50 }),
)
const routers = computed(() => routersData.value?.results ?? [])

const { data: accessPointsData } = await useAsyncData('admin-microtik-aps', () => listAccessPointsWithLocation())
const accessPointOptions = computed(() => accessPointsData.value?.results ?? [])

const routerStatusTone = (status: string) =>
  status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : 'warning'

const actionError = ref('')

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

// The wording depends on what is being done to what: approving a new router,
// rejecting one still awaiting approval, or REVOKING one that is already live
// (which has real consequences, so it says what they are).
const routerDialogTitle = computed(() => {
  const { type, router } = confirmRouterAction.value ?? {}
  if (type === 'approve') return router?.status === 'REJECTED' ? 'Approve this MikroTik again?' : 'Approve this MikroTik?'
  return router?.status === 'APPROVED' ? 'Revoke this MikroTik?' : 'Reject this MikroTik?'
})
const routerDialogDescription = computed(() => {
  const { type, router } = confirmRouterAction.value ?? {}
  if (type === 'approve') {
    return 'It will be accepted as one of your MikroTiks, and it will be trusted again automatically whenever it reconnects.'
  }
  if (router?.status === 'APPROVED') {
    return 'Its reports will be refused and it won\'t be sent any block or connect commands, its devices will show as offline, and anything still waiting on it will fail. It stays revoked even if it reconnects, until you approve it again. Customers behind it keep whatever access it last applied.'
  }
  return 'It will be refused until you approve it. Reconnecting won\'t change that.'
})
const routerDialogConfirm = computed(() => {
  const { type, router } = confirmRouterAction.value ?? {}
  if (type === 'approve') return 'Approve'
  return router?.status === 'APPROVED' ? 'Revoke' : 'Reject'
})

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

// --- Devices (server-side filtered, searched and paged) ---------------------
const page = ref(1)
const searchInput = ref('')
const search = ref('')
const routerFilter = ref('')
const accessFilter = ref('')

// Debounced so typing doesn't fire a request per keystroke.
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { search.value = value.trim() }, 300)
})

const leaseParams = computed(() => {
  const params: Record<string, string | number | boolean> = { page: page.value, page_size: 20 }
  if (tab.value === 'online') params.online = true
  if (tab.value === 'offline') params.online = false
  if (tab.value === 'unallocated') params.allocated = false
  if (search.value) params.search = search.value
  if (routerFilter.value) params.router = routerFilter.value
  if (accessFilter.value) params.access_state = accessFilter.value
  return params
})

const { data: leasesData, pending: leasesPending, error: leasesError, refresh: refreshLeases } = await useAsyncData(
  'admin-microtik-leases',
  () => (isDeviceTab.value ? listLeases(leaseParams.value) : Promise.resolve(null)),
  { watch: [leaseParams, isDeviceTab] },
)
const leases = computed(() => leasesData.value?.results ?? [])

// Back to page 1 whenever the question being asked changes.
watch([tab, search, routerFilter, accessFilter], () => { page.value = 1 })

function openDevices(router: MikroTikRouter, target: 'online' | 'offline' | 'unallocated') {
  routerFilter.value = router.id
  accessFilter.value = ''
  searchInput.value = ''
  search.value = ''
  tab.value = target
}

const emptyCopy = computed(() => {
  if (search.value || routerFilter.value || accessFilter.value) {
    return { title: 'No devices match', description: 'Try clearing the search or filters.' }
  }
  if (tab.value === 'online') return { title: 'No devices online', description: 'Devices appear here while a MikroTik can see them.' }
  if (tab.value === 'offline') return { title: 'No offline devices', description: 'A device that a MikroTik has seen before but can no longer see appears here.' }
  return { title: 'Everything is allocated', description: 'Every device a MikroTik has reported is matched to a customer.' }
})

// --- Block / connect + allocation -------------------------------------------
const controls = useLeaseControls(() => refreshAll())
const allocatingLease = ref<MikroTikLease | null>(null)

// --- Command history ----------------------------------------------------------
const { data: commandsData, pending: commandsPending, error: commandsError, refresh: refreshCommands } = await useAsyncData(
  'admin-microtik-commands', () => listCommands({ page_size: 50 }),
)
const commands = computed(() => commandsData.value?.results ?? [])
const commandStatusTone = (status: string) =>
  status === 'CONFIRMED' ? 'success' : status === 'FAILED' ? 'error' : status === 'SENT' ? 'info' : 'neutral'
const commandStatusLabel = (status: string) =>
  status === 'CONFIRMED' ? 'Confirmed' : status === 'SENT' ? 'Waiting for router' : status === 'FAILED' ? 'Failed' : 'Pending'

// --- Forget an unallocated, offline device ---------------------------------------
const forgettingLease = ref<MikroTikLease | null>(null)
const forgetting = ref(false)
const notice = ref('')
async function handleForget() {
  if (!forgettingLease.value) return
  forgetting.value = true
  actionError.value = ''
  notice.value = ''
  try {
    await forgetLease(forgettingLease.value.id)
    notice.value = 'Device forgotten.'
  } catch (err) {
    actionError.value = apiErrorMessage(err, "Couldn't forget this device. Please try again.")
  } finally {
    forgetting.value = false
    forgettingLease.value = null
    await refreshAll()
  }
}

// --- Command history: delete one / clear all ---------------------------------------
const deletingCommand = ref<MikroTikCommand | null>(null)
const confirmClear = ref(false)
const historyBusy = ref(false)
async function handleDeleteCommand() {
  if (!deletingCommand.value) return
  historyBusy.value = true
  actionError.value = ''
  notice.value = ''
  try {
    await deleteCommand(deletingCommand.value.id)
  } catch (err) {
    actionError.value = apiErrorMessage(err, "Couldn't delete this entry. Please try again.")
  } finally {
    historyBusy.value = false
    deletingCommand.value = null
    await refreshCommands()
  }
}
async function handleClearHistory() {
  historyBusy.value = true
  actionError.value = ''
  notice.value = ''
  try {
    const result = await clearCommands()
    notice.value = result.kept
      ? `Cleared ${result.deleted} ${result.deleted === 1 ? 'entry' : 'entries'}. ${result.kept} still ${result.kept === 1 ? 'waits' : 'wait'} for a MikroTik to confirm and ${result.kept === 1 ? 'was' : 'were'} kept.`
      : `Cleared ${result.deleted} ${result.deleted === 1 ? 'entry' : 'entries'}.`
  } catch (err) {
    actionError.value = apiErrorMessage(err, "Couldn't clear the history. Please try again.")
  } finally {
    historyBusy.value = false
    confirmClear.value = false
    await refreshCommands()
  }
}

// --- Refresh ----------------------------------------------------------------------
async function refreshAll() {
  await Promise.all([
    refreshSummary(),
    refreshRouters(),
    isDeviceTab.value ? refreshLeases() : Promise.resolve(),
    tab.value === 'commands' ? refreshCommands() : Promise.resolve(),
  ])
}

// A block/connect settles when the MikroTik's next report arrives (roughly
// every 20s), so poll quietly to let Pending turn into Blocked/Allowed
// without anyone pressing Refresh. Skipped while the tab is hidden.
let poller: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  poller = setInterval(() => { if (!document.hidden) refreshAll() }, 10_000)
})
onBeforeUnmount(() => {
  clearInterval(poller)
  clearTimeout(searchTimer)
})

const selectClass = 'rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent'
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-text-primary">MikroTik Management</h1>
      <button type="button" class="btn-secondary" @click="refreshAll()">Refresh</button>
    </div>

    <!-- Tabs (scroll sideways on narrow screens rather than wrapping) -->
    <div class="overflow-x-auto">
      <div class="inline-flex min-w-max rounded-card border border-border bg-surface p-0.5" role="tablist">
        <button
          v-for="t in tabs" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key"
          class="flex items-center gap-1.5 whitespace-nowrap rounded-[0.4rem] px-3 py-1.5 text-sm font-medium transition-colors sm:px-4"
          :class="tab === t.key ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
          @click="tab = t.key"
        >
          {{ t.label }}
          <span
            v-if="t.count !== undefined"
            class="rounded-full px-1.5 py-0.5 text-xs leading-none"
            :class="tab === t.key
              ? 'bg-white/20 text-white'
              : t.key === 'unallocated' && t.count > 0 ? 'bg-warning/10 text-warning' : 'bg-text-secondary/10 text-text-secondary'"
          >{{ t.count }}</span>
        </button>
      </div>
    </div>

    <p v-if="summary && summary.pending > 0" class="text-sm text-text-secondary">
      {{ summary.pending }} {{ summary.pending === 1 ? 'device is' : 'devices are' }} waiting for a MikroTik to confirm a block or connect.
    </p>

    <p v-if="actionError" role="alert" class="rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">{{ actionError }}</p>
    <p v-if="controls.error.value" role="alert" class="rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">{{ controls.error.value }}</p>
    <p v-if="controls.notice.value" role="status" class="rounded-card border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">{{ controls.notice.value }}</p>
    <p v-if="notice" role="status" class="rounded-card border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">{{ notice }}</p>

    <!-- MikroTiks -->
    <div v-if="tab === 'routers'" class="space-y-5">
      <LoadingState v-if="routersPending && !routersData" :rows="4" />
      <ErrorState v-else-if="routersError" @retry="refreshRouters()" />
      <EmptyState
        v-else-if="!routers.length" :icon="Router" title="No MikroTiks yet"
        description="A MikroTik appears here automatically the first time it checks in with the device-communication service."
      />
      <div v-else v-for="r in routers" :key="r.id" class="rounded-card border border-border bg-surface">
        <div class="border-b border-border p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <p class="font-medium text-text-primary">{{ r.identity || 'Unnamed MikroTik' }}</p>
              <p class="break-all font-mono text-xs text-text-secondary">{{ r.signature }}</p>
              <p class="mt-1 text-xs text-text-secondary">
                {{ r.model || 'Unknown model' }}{{ r.firmware ? ` · v${r.firmware}` : '' }} ·
                Last seen {{ r.last_seen_at ? formatRelativeTime(r.last_seen_at) : 'never' }}
              </p>
            </div>
            <div class="flex flex-col gap-2 sm:items-end">
              <div class="flex flex-wrap items-center gap-2">
                <StatusBadge v-if="r.status === 'APPROVED' && !r.is_reporting" label="Not reporting" tone="warning" />
                <StatusBadge :label="r.status" :tone="routerStatusTone(r.status)" />
              </div>
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
              :value="r.access_point ?? ''" :disabled="linkingRouterId === r.id" class="w-full" :class="selectClass"
              @change="handleLinkAccessPoint(r, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Not linked</option>
              <option v-for="ap in accessPointOptions" :key="ap.id" :value="ap.id">{{ ap.name }}</option>
            </select>
          </div>
        </div>

        <div class="p-4">
          <p v-if="r.status === 'APPROVED' && !r.is_reporting" class="mb-3 rounded-card border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-text-primary">
            This MikroTik hasn't checked in recently, so its devices can't be confirmed as online and block or connect
            requests won't take effect until it reports again.
          </p>
          <div class="grid grid-cols-3 gap-2 sm:gap-3">
            <button type="button" class="rounded-card border border-border p-3 text-left transition-colors hover:border-accent/50 hover:bg-text-secondary/5" @click="openDevices(r, 'online')">
              <span class="flex items-center gap-1.5 text-xs text-text-secondary"><Wifi class="h-3.5 w-3.5 text-success" aria-hidden="true" />Online</span>
              <span class="mt-0.5 block text-xl font-semibold text-text-primary">{{ r.online_lease_count }}</span>
            </button>
            <button type="button" class="rounded-card border border-border p-3 text-left transition-colors hover:border-accent/50 hover:bg-text-secondary/5" @click="openDevices(r, 'offline')">
              <span class="flex items-center gap-1.5 text-xs text-text-secondary"><WifiOff class="h-3.5 w-3.5" aria-hidden="true" />Offline</span>
              <span class="mt-0.5 block text-xl font-semibold text-text-primary">{{ r.offline_lease_count }}</span>
            </button>
            <button type="button" class="rounded-card border border-border p-3 text-left transition-colors hover:border-accent/50 hover:bg-text-secondary/5" @click="openDevices(r, 'unallocated')">
              <span class="flex items-center gap-1.5 text-xs text-text-secondary"><UserX class="h-3.5 w-3.5 text-warning" aria-hidden="true" />Unallocated</span>
              <span class="mt-0.5 block text-xl font-semibold" :class="r.unallocated_lease_count > 0 ? 'text-warning' : 'text-text-primary'">{{ r.unallocated_lease_count }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Devices: online / offline / needs allocation -->
    <div v-else-if="isDeviceTab" class="space-y-4">
      <p class="text-sm text-text-secondary">
        <template v-if="tab === 'online'">Devices a MikroTik can see right now.</template>
        <template v-else-if="tab === 'offline'">
          Devices a MikroTik has seen before but can't see right now. They stay on record with their customer, so you can
          still block or connect them — the change applies as soon as they return.
        </template>
        <template v-else>
          Devices not matched to any customer yet, online or not. Allocate each one to the customer it belongs to.
        </template>
      </p>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput v-model="searchInput" placeholder="Search by MAC, IP, hostname or customer…" class="sm:max-w-sm sm:flex-1" />
        <select v-if="routers.length > 1" v-model="routerFilter" :class="selectClass" aria-label="Filter by MikroTik">
          <option value="">All MikroTiks</option>
          <option v-for="r in routers" :key="r.id" :value="r.id">{{ r.identity || r.signature }}</option>
        </select>
        <select v-model="accessFilter" :class="selectClass" aria-label="Filter by access">
          <option value="">Any access</option>
          <option value="ALLOWED">Allowed</option>
          <option value="BLOCKED">Blocked</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      <LoadingState v-if="leasesPending && !leasesData" :rows="5" />
      <ErrorState v-else-if="leasesError" @retry="refreshLeases()" />
      <EmptyState v-else-if="!leases.length" :icon="Router" :title="emptyCopy.title" :description="emptyCopy.description" />
      <template v-else>
        <MikroTikDeviceList
          :leases="leases" :acting-id="controls.actingId.value"
          @block="controls.ask($event, 'block')" @connect="controls.ask($event, 'reconnect')"
          @allocate="allocatingLease = $event" @reallocate="allocatingLease = $event"
          @forget="forgettingLease = $event"
        />
        <Pagination :current-page="page" :total-pages="leasesData?.total_pages ?? 1" @change="page = $event" />
      </template>
    </div>

    <!-- Command history -->
    <div v-else class="space-y-4">
      <div class="flex justify-end">
        <button type="button" class="btn-danger" :disabled="historyBusy || !commands.length" @click="confirmClear = true">Clear history</button>
      </div>
      <p class="rounded-card border border-dashed border-border bg-surface p-3 text-sm text-text-secondary">
        <span class="font-semibold text-text-primary">Waiting for router</span> means the command was queued for the
        MikroTik's next check-in. It becomes <span class="font-semibold text-success">Confirmed</span> when a later report
        shows the change took effect, or <span class="font-semibold text-error">Failed</span> if it couldn't be delivered or
        the MikroTik never applied it in time.
      </p>
      <LoadingState v-if="commandsPending && !commandsData" :rows="5" />
      <ErrorState v-else-if="commandsError" @retry="refreshCommands()" />
      <EmptyState v-else-if="!commands.length" title="No commands sent yet" />
      <div v-else>
        <div class="hidden md:block">
          <DataTable
            :columns="[
              { key: 'mac', label: 'MAC Address' },
              { key: 'command_type', label: 'Command' },
              { key: 'customer', label: 'Customer' },
              { key: 'router', label: 'Via MikroTik' },
              { key: 'status', label: 'Status' },
              { key: 'created_at', label: 'When' },
              { key: 'actions', label: '' },
            ]"
            :rows="commands" row-key="id"
          >
            <template #cell-mac="{ row }"><span class="font-mono text-xs">{{ row.mac_address }}</span></template>
            <template #cell-command_type="{ row }">{{ row.command_type === 'block' ? 'Block' : 'Connect' }}</template>
            <template #cell-customer="{ row }">{{ row.customer_name || '—' }}</template>
            <template #cell-router="{ row }">{{ row.router_identity || 'Unnamed MikroTik' }}</template>
            <template #cell-status="{ row }">
              <StatusBadge :label="commandStatusLabel(row.status)" :tone="commandStatusTone(row.status)" />
              <p v-if="row.error_message" class="mt-1 max-w-xs whitespace-normal text-xs text-error">{{ row.error_message }}</p>
            </template>
            <template #cell-created_at="{ row }">{{ formatRelativeTime(row.created_at) }}</template>
            <template #cell-actions="{ row }">
              <button
                type="button" :disabled="historyBusy" :aria-label="`Delete this ${row.command_type} entry`"
                class="rounded-card p-1.5 text-text-secondary transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                @click.stop="deletingCommand = row as MikroTikCommand"
              ><Trash2 class="h-4 w-4" aria-hidden="true" /></button>
            </template>
          </DataTable>
        </div>
        <ul class="space-y-3 md:hidden">
          <li v-for="c in commands" :key="c.id" class="rounded-card border border-border bg-surface p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-text-primary">{{ c.command_type === 'block' ? 'Block' : 'Connect' }} · {{ c.customer_name || 'No customer' }}</p>
                <p class="break-all font-mono text-xs text-text-secondary">{{ c.mac_address }}</p>
                <p class="text-xs text-text-secondary">via {{ c.router_identity || 'Unnamed MikroTik' }}</p>
              </div>
              <StatusBadge :label="commandStatusLabel(c.status)" :tone="commandStatusTone(c.status)" class="shrink-0" />
            </div>
            <p v-if="c.error_message" class="mt-2 text-xs text-error">{{ c.error_message }}</p>
            <div class="mt-2 flex items-center justify-between gap-3">
              <p class="text-xs text-text-secondary">{{ formatRelativeTime(c.created_at) }}</p>
              <button
                type="button" :disabled="historyBusy"
                class="inline-flex items-center gap-1 rounded-card border border-error/40 px-2.5 py-1 text-xs font-medium text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                @click="deletingCommand = c"
              ><Trash2 class="h-3.5 w-3.5" aria-hidden="true" />Delete</button>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <ConfirmationDialog
      :open="!!forgettingLease"
      title="Forget this device?"
      :description="`${forgettingLease?.hostname || forgettingLease?.mac_address || 'This device'} will be removed from this list. It only removes the record: if the device is still on the MikroTik's allowed list it keeps its internet access, and if it connects again it reappears here as unallocated. Block it first if you don't want it online.`"
      :confirm-label="forgetting ? 'Please wait…' : 'Forget device'"
      danger
      @confirm="handleForget"
      @cancel="forgettingLease = null"
    />
    <ConfirmationDialog
      :open="!!deletingCommand"
      title="Delete this history entry?"
      description="This removes the entry from the command history. It doesn't undo the block or connect itself."
      :confirm-label="historyBusy ? 'Please wait…' : 'Delete'"
      danger
      @confirm="handleDeleteCommand"
      @cancel="deletingCommand = null"
    />
    <ConfirmationDialog
      :open="confirmClear"
      title="Clear the whole command history?"
      description="Every entry will be removed. Commands a device is still waiting on are kept until the MikroTik confirms them. This doesn't undo any block or connect."
      :confirm-label="historyBusy ? 'Please wait…' : 'Clear history'"
      danger
      @confirm="handleClearHistory"
      @cancel="confirmClear = false"
    />
    <LeaseAllocationModal :lease="allocatingLease" @close="allocatingLease = null" @updated="refreshAll()" />

    <ConfirmationDialog
      :open="!!confirmRouterAction"
      :title="routerDialogTitle"
      :description="routerDialogDescription"
      :confirm-label="actingRouterId ? 'Please wait…' : routerDialogConfirm"
      :danger="confirmRouterAction?.type === 'reject'"
      @confirm="handleConfirmRouterAction"
      @cancel="confirmRouterAction = null"
    />
    <ConfirmationDialog
      :open="controls.dialog.value.open"
      :title="controls.dialog.value.title"
      :description="controls.dialog.value.description"
      :confirm-label="controls.dialog.value.confirmLabel"
      :danger="controls.dialog.value.danger"
      @confirm="controls.confirm()"
      @cancel="controls.cancel()"
    />
  </div>
</template>

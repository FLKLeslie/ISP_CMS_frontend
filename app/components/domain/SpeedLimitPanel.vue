<script setup lang="ts">
// The controls for command 2, "Bandwidth Limit" (the title, summary and longer
// explanation come from CommandSection): set or remove ONE device's speed limit
// ("capping") - the uplink and downlink the MikroTik should hold it to.
//
// Pick the device either from the routers that belong to customers, or by typing
// its MAC address (and choosing which MikroTik it sits behind). Whichever way, the
// device's CURRENT limit is shown first - "Default" if none was ever set - so the
// administrator always knows what they are changing.
//
// "Default" means the MikroTik hears nothing about speed for that device. Removing
// a limit sends a command that puts it back to that state.
//
// Honest about what is known: the limit is QUEUED for the router's next check-in.
// The router doesn't report speed back, so it can't be confirmed - the panel says
// so rather than claiming it is applied. The administrators are also notified, with
// full details, by the backend whenever a limit is set, removed or fails.
import { X } from 'lucide-vue-next'
import type { MikroTikLease, MikroTikRouter } from '~/types/api/microtik'

const props = defineProps<{ routers: MikroTikRouter[] }>()
const emit = defineEmits<{ changed: [] }>()

const { listLeases, setLeaseLimit, clearLeaseLimit, sendCommandByMac } = useMikroTikApi()

const field = 'w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent'

// Only an approved router can receive anything.
const approved = computed(() => props.routers.filter((r) => r.status === 'APPROVED'))
const routerName = (r: Pick<MikroTikRouter, 'label' | 'identity' | 'signature'>) =>
  r.label || r.identity || `MikroTik ${r.signature.slice(0, 8)}`

// --- 1. Choose the device ------------------------------------------------------
const mode = ref<'customer' | 'mac'>('customer')

// Customer mode: search the routers that are tied to customers.
const search = ref('')
const { data: pickerData, pending: pickerPending } = await useAsyncData(
  'speed-panel-picker',
  () => listLeases({ allocated: true, page_size: 12, ...(search.value.trim() ? { search: search.value.trim() } : {}) }),
  { watch: [search] },
)
const pickerRows = computed(() => pickerData.value?.results ?? [])
const picked = ref<MikroTikLease | null>(null)

// MAC mode: type a MAC and say which MikroTik it sits behind.
const mac = ref('')
const macRouterId = ref('')
const MAC_RE = /^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$|^[0-9a-fA-F]{12}$/
const macValid = computed(() => MAC_RE.test(mac.value.trim()))
// The form the backend stores: lowercase, colon-separated.
const normalizedMac = computed(() => {
  const hex = mac.value.replace(/[^0-9a-fA-F]/g, '').toLowerCase()
  return hex.length === 12 ? hex.match(/../g)!.join(':') : ''
})

// Does the typed MAC already have a record on that MikroTik? If so we know its current limit.
const { data: macLookup, pending: macLookupPending, refresh: refreshMacLookup } = await useAsyncData(
  'speed-panel-mac-lookup',
  () => (macValid.value && macRouterId.value
    ? listLeases({ mac_address: normalizedMac.value, router: macRouterId.value })
    : Promise.resolve(null)),
  { watch: [normalizedMac, macRouterId] },
)

// The device being worked on, whichever way it was chosen. `lease` is null when a
// typed MAC has never been seen by that MikroTik (it will be created on sending).
const target = computed(() => {
  if (mode.value === 'customer') {
    const lease = picked.value
    return lease ? { mac: lease.mac_address, routerId: lease.router, lease } : null
  }
  if (!macValid.value || !macRouterId.value) return null
  return { mac: normalizedMac.value, routerId: macRouterId.value, lease: macLookup.value?.results?.[0] ?? null }
})
const targetRouter = computed(() => props.routers.find((r) => r.id === target.value?.routerId) ?? null)
const targetOwner = computed(() => {
  const lease = target.value?.lease
  return lease?.customer_name ? `${lease.customer_name}` : null
})

function pick(lease: MikroTikLease) {
  picked.value = lease
  result.value = null; formError.value = ''
}
function switchMode(next: 'customer' | 'mac') {
  mode.value = next
  result.value = null; formError.value = ''
}

// --- 2. Its current limit ---------------------------------------------------------
const current = computed(() => target.value?.lease ?? null)
const hasLimit = computed(() => !!current.value?.has_speed_limit)
const limitedBy = computed(() => {
  const lease = current.value
  if (!lease?.has_speed_limit) return ''
  if (lease.limit_source === 'PLAN') return `set by the ${lease.limit_plan_name || 'a'} plan`
  if (lease.limit_source === 'MANUAL') return 'set by an administrator'
  return ''
})

// --- 3. The new limit ----------------------------------------------------------------
const uplink = ref<number | null>(null)
const downlink = ref<number | null>(null)
// Start from what the device has now, so adjusting one direction is one edit.
// Keyed on the device's identity (not the whole lease object) so a background
// refresh doesn't wipe what the administrator is typing.
watch(() => [target.value?.mac, target.value?.routerId, current.value?.id], () => {
  uplink.value = current.value?.uplink_kbps ?? null
  downlink.value = current.value?.downlink_kbps ?? null
}, { immediate: true })
const canSet = computed(() => !!target.value && uplink.value != null && downlink.value != null)
const unchanged = computed(() =>
  hasLimit.value && current.value!.uplink_kbps === uplink.value && current.value!.downlink_kbps === downlink.value,
)

// --- Sending -----------------------------------------------------------------------
const busy = ref(false)
const formError = ref('')
const result = ref<{ text: string } | null>(null)
const confirming = ref<'set' | 'clear' | null>(null)

function ask(kind: 'set' | 'clear') {
  formError.value = ''; result.value = null
  if (!target.value) { formError.value = 'Choose a device first.'; return }
  if (kind === 'set' && !canSet.value) { formError.value = 'Enter both an uplink and a downlink speed.'; return }
  confirming.value = kind
}

const where = computed(() => `${targetOwner.value ?? target.value?.mac} on ${targetRouter.value ? routerName(targetRouter.value) : 'that MikroTik'}`)
const confirmTitle = computed(() => (confirming.value === 'clear' ? 'Remove this speed limit?' : 'Set this speed limit?'))
const confirmText = computed(() => {
  if (confirming.value === 'clear') {
    return `${where.value} will go back to the default: the MikroTik will be told to apply no uplink or downlink limit to it.`
  }
  return `${where.value} will be capped at ${describeLimit(uplink.value, downlink.value)}`
    + `${hasLimit.value ? `, replacing ${describeLimit(current.value!.uplink_kbps, current.value!.downlink_kbps)}` : ''}. `
    + 'Internet access is not changed.'
})

async function confirmed() {
  const kind = confirming.value
  const t = target.value
  if (!kind || !t) return
  busy.value = true; formError.value = ''; result.value = null
  try {
    if (t.lease) {
      // A known device: its own endpoints (409 if an access change is still pending for it).
      kind === 'set'
        ? await setLeaseLimit(t.lease.id, uplink.value!, downlink.value!)
        : await clearLeaseLimit(t.lease.id)
    } else {
      // A MAC this MikroTik has never reported: the send endpoint creates its record.
      const response = await sendCommandByMac({
        macAddress: t.mac, router: t.routerId,
        commandType: kind === 'set' ? 'set_limit' : 'clear_limit',
        ...(kind === 'set' ? { uplinkKbps: uplink.value!, downlinkKbps: downlink.value! } : {}),
      })
      const first = response.results[0]
      if (first && 'conflict' in first) throw new Error(first.detail)
      if (first && 'status' in first && first.status === 'FAILED') throw new Error(first.error_message || 'The MikroTik could not be reached.')
    }
    result.value = {
      text: kind === 'set'
        ? `Queued: ${where.value} → ${describeLimit(uplink.value, downlink.value)}.`
        : `Queued: ${where.value} → back to the default speed.`,
    }
    await Promise.all([
      refreshMacLookup(),
      refreshNuxtData('speed-panel-picker'),
    ])
    // The picker row we hold is now stale - swap in the fresh copy.
    if (picked.value) picked.value = pickerRows.value.find((l) => l.id === picked.value!.id) ?? await refetchPicked(picked.value.id)
    emit('changed')
  } catch (err) {
    formError.value = err instanceof Error && !('statusCode' in err) && !('data' in err)
      ? err.message
      : apiErrorMessage(err, "Couldn't change this speed limit. Please try again.")
  } finally {
    busy.value = false; confirming.value = null
  }
}

async function refetchPicked(id: string): Promise<MikroTikLease | null> {
  const page = await listLeases({ mac_address: picked.value!.mac_address, router: picked.value!.router })
  return page.results.find((l) => l.id === id) ?? null
}
</script>

<template>
  <div class="space-y-4">
    <!-- 1. Which device -->
    <div>
      <div class="mb-2 inline-flex rounded-card border border-border p-0.5" role="tablist" aria-label="How to choose the device">
        <button
          type="button" role="tab" :aria-selected="mode === 'customer'"
          class="rounded-card px-3 py-1 text-xs font-medium transition-colors"
          :class="mode === 'customer' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
          @click="switchMode('customer')"
        >A customer's router</button>
        <button
          type="button" role="tab" :aria-selected="mode === 'mac'"
          class="rounded-card px-3 py-1 text-xs font-medium transition-colors"
          :class="mode === 'mac' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
          @click="switchMode('mac')"
        >Type a MAC address</button>
      </div>

      <div v-if="mode === 'customer'" class="space-y-2">
        <SearchInput v-model="search" placeholder="Search by customer, MAC address, hostname or IP…" />
        <div class="max-h-56 overflow-y-auto rounded-card border border-border">
          <p v-if="pickerPending && !pickerRows.length" class="px-3 py-3 text-sm text-text-secondary">Loading…</p>
          <p v-else-if="!pickerRows.length" class="px-3 py-3 text-sm text-text-secondary">
            {{ search ? 'No customer router matches that.' : 'No router has been allocated to a customer yet.' }}
          </p>
          <button
            v-for="lease in pickerRows" :key="lease.id" type="button"
            class="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-text-secondary/10"
            :class="picked?.id === lease.id ? 'bg-secondary/10' : ''" @click="pick(lease)"
          >
            <span class="min-w-0">
              <span class="block truncate font-medium text-text-primary">{{ lease.customer_name }}</span>
              <span class="block truncate font-mono text-xs text-text-secondary">
                {{ lease.mac_address }}<span v-if="lease.hostname" class="font-sans"> · {{ lease.hostname }}</span>
              </span>
            </span>
            <span class="shrink-0 text-xs" :class="lease.has_speed_limit ? 'text-text-primary' : 'text-text-secondary'">
              {{ lease.has_speed_limit ? describeLimit(lease.uplink_kbps, lease.downlink_kbps) : 'Default' }}
            </span>
          </button>
        </div>
      </div>

      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label for="speed-mac" class="mb-1 block text-xs font-medium text-text-secondary">MAC address</label>
          <input
            id="speed-mac" v-model="mac" type="text" placeholder="AA:BB:CC:DD:EE:FF" :class="field" class="font-mono"
            :aria-invalid="!!mac && !macValid"
          >
          <p v-if="mac && !macValid" class="mt-1 text-xs text-error">That doesn't look like a MAC address.</p>
        </div>
        <div>
          <label for="speed-router" class="mb-1 block text-xs font-medium text-text-secondary">MikroTik it sits behind</label>
          <select id="speed-router" v-model="macRouterId" :class="field">
            <option value="" disabled>Choose a MikroTik…</option>
            <option v-for="r in approved" :key="r.id" :value="r.id">{{ routerName(r) }}</option>
          </select>
          <p v-if="!approved.length" class="mt-1 text-xs text-warning">No approved MikroTiks yet.</p>
        </div>
      </div>
    </div>

    <!-- 2. Current limit + 3. New limit -->
    <div v-if="target" class="space-y-4 rounded-card border border-border bg-background p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-text-primary">{{ targetOwner ?? 'Not allocated to a customer' }}</p>
          <p class="font-mono text-xs text-text-secondary">
            {{ target.mac }}<span v-if="targetRouter" class="font-sans"> · via {{ routerName(targetRouter) }}</span>
          </p>
        </div>
        <div class="text-right" aria-live="polite">
          <p class="text-xs text-text-secondary">Current speed</p>
          <p v-if="macLookupPending && mode === 'mac'" class="text-sm text-text-secondary">Checking…</p>
          <template v-else-if="hasLimit">
            <p class="text-sm font-semibold text-text-primary">{{ describeLimit(current!.uplink_kbps, current!.downlink_kbps) }}</p>
            <p class="text-xs text-text-secondary">
              {{ limitedBy }}<template v-if="current!.limit_set_at"> · {{ formatRelativeTime(current!.limit_set_at) }}</template>
            </p>
          </template>
          <template v-else>
            <p class="text-sm font-semibold text-text-primary">Default</p>
            <p class="text-xs text-text-secondary">
              {{ current ? 'No uplink or downlink limit is set' : 'This MikroTik has no record of this device yet' }}
            </p>
          </template>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs font-medium text-text-secondary">Uplink <span class="font-normal">(upload)</span></label>
          <SpeedInput v-model="uplink" label="Uplink" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text-secondary">Downlink <span class="font-normal">(download)</span></label>
          <SpeedInput v-model="downlink" label="Downlink" />
        </div>
      </div>

      <p v-if="formError" role="alert" class="rounded-card border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{{ formError }}</p>
      <p v-if="result" role="status" class="rounded-card border border-success/30 bg-success/5 px-3 py-2 text-sm text-text-primary">
        {{ result.text }}
        <span class="block text-xs text-text-secondary">
          {{ targetRouter ? routerName(targetRouter) : 'The MikroTik' }} applies it on its next check-in (usually within about 20 seconds).
          Routers don't report speed back, so this can't be confirmed from here. Administrators have been notified.
        </span>
      </p>

      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-primary" :disabled="busy || !canSet || unchanged" @click="ask('set')">
          {{ busy && confirming === 'set' ? 'Sending…' : hasLimit ? 'Change speed limit' : 'Set speed limit' }}
        </button>
        <button
          type="button" class="btn-secondary" :disabled="busy || !hasLimit"
          :title="hasLimit ? 'Go back to the default speed' : 'This device is already on the default speed'"
          @click="ask('clear')"
        >
          <X class="mr-1 inline h-4 w-4" aria-hidden="true" />Remove limit (use default)
        </button>
      </div>
    </div>
    <p v-else class="text-sm text-text-secondary">
      {{ mode === 'customer' ? 'Choose a customer\'s router above to see and change its speed.' : 'Enter a MAC address and choose its MikroTik to see and change its speed.' }}
    </p>

    <ConfirmationDialog
      :open="!!confirming" :title="confirmTitle" :description="confirmText"
      :confirm-label="busy ? 'Please wait…' : confirming === 'clear' ? 'Remove limit' : 'Set limit'"
      @confirm="confirmed" @cancel="confirming = null"
    />
  </div>
</template>

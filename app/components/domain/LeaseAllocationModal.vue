<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import type { AllocatableCustomer, MikroTikLease } from '~/types/api/microtik'

// One modal for all three allocation actions on a device:
//   - Allocate     (device has no customer)   pick a customer
//   - Reallocate   (device has a customer)    pick a different customer
//   - Unallocate   (device has a customer)    take it back to "needs allocation"
//
// The picker only ever lists customers who have NOT been allocated to any
// router yet (server-side), with search. Picking a row selects it; a second,
// explicit button confirms — so a stray tap on a phone can't move a device.
// The parent controls visibility via `lease` (null = closed) and refreshes
// its own lists on `updated`.
const props = defineProps<{ lease: MikroTikLease | null }>()
const emit = defineEmits<{ close: []; updated: [] }>()

const { listAllocatableCustomers, allocateLease, unallocateLease } = useMikroTikApi()

const isReallocation = computed(() => !!props.lease?.is_allocated)

// --- picker ---------------------------------------------------------------
const searchInput = ref('')
const search = ref('')
const page = ref(1)
const customers = ref<AllocatableCustomer[]>([])
const totalPages = ref(1)
const loading = ref(false)
const loadError = ref('')
const selectedId = ref<string | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { search.value = value.trim(); page.value = 1 }, 300)
})

// Only the newest request may write results, so a slow response for an
// older search can't overwrite a newer one.
let requestSeq = 0
async function load() {
  if (!props.lease) return
  const seq = ++requestSeq
  loading.value = true
  loadError.value = ''
  try {
    const result = await listAllocatableCustomers({ search: search.value, page: page.value, page_size: 8 })
    if (seq !== requestSeq) return
    customers.value = result.results
    totalPages.value = result.total_pages
  } catch (err) {
    if (seq !== requestSeq) return
    loadError.value = apiErrorMessage(err, "Couldn't load customers. Please try again.")
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}
watch([search, page], load)

// --- actions --------------------------------------------------------------
const submitting = ref(false)
const actionError = ref('')
const confirmingUnallocate = ref(false)

// Start fresh every time a (different) device is opened.
watch(() => props.lease?.id, (id) => {
  clearTimeout(searchTimer)
  searchInput.value = ''
  search.value = ''
  page.value = 1
  customers.value = []
  totalPages.value = 1
  selectedId.value = null
  actionError.value = ''
  confirmingUnallocate.value = false
  if (id) load()
}, { immediate: true })

async function submitAllocation() {
  if (!props.lease || !selectedId.value) return
  submitting.value = true
  actionError.value = ''
  try {
    await allocateLease(props.lease.id, selectedId.value)
    emit('updated')
    emit('close')
  } catch (err) {
    actionError.value = apiErrorMessage(err, "Couldn't allocate this device. Please try again.")
  } finally {
    submitting.value = false
  }
}

async function submitUnallocate() {
  if (!props.lease) return
  submitting.value = true
  actionError.value = ''
  try {
    await unallocateLease(props.lease.id)
    emit('updated')
    emit('close')
  } catch (err) {
    actionError.value = apiErrorMessage(err, "Couldn't unallocate this device. Please try again.")
  } finally {
    submitting.value = false
  }
}

// --- Escape to close --------------------------------------------------------
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.lease && !submitting.value) emit('close')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(searchTimer)
})
</script>

<template>
  <div
    v-if="lease"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:px-4"
    @mousedown.self="!submitting && emit('close')"
  >
    <div
      class="flex max-h-[92vh] w-full flex-col rounded-t-card border border-border bg-surface shadow-xl sm:max-w-md sm:rounded-card"
      role="dialog" aria-modal="true" aria-labelledby="allocate-title"
    >
      <!-- Header: which device this is about -->
      <div class="border-b border-border p-5">
        <h2 id="allocate-title" class="text-base font-semibold text-text-primary">
          {{ isReallocation ? 'Reallocate device' : 'Allocate device' }}
        </h2>
        <p class="mt-1 truncate text-sm text-text-primary">{{ lease.hostname || 'Unnamed device' }}</p>
        <p class="break-all font-mono text-xs text-text-secondary">
          {{ lease.mac_address }}<span v-if="lease.ip_address"> · {{ lease.ip_address }}</span>
        </p>
        <p v-if="isReallocation" class="mt-2 text-sm text-text-secondary">
          Currently allocated to
          <span class="font-medium text-text-primary">{{ lease.customer_name }}</span>.
          Choose who it should belong to instead.
        </p>
        <p v-else class="mt-2 text-sm text-text-secondary">
          Choose the customer this device belongs to. Their router details are updated to match, so every future
          report from the MikroTik recognises them automatically.
        </p>
      </div>

      <!-- Body: customer picker (scrolls on small screens) -->
      <div class="flex-1 space-y-4 overflow-y-auto p-5">
        <div>
          <SearchInput v-model="searchInput" placeholder="Search by name, email or phone…" />
          <p class="mt-1.5 text-xs text-text-secondary">Only customers without a router are listed.</p>
        </div>

        <p v-if="loadError" role="alert" class="rounded-card border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
          {{ loadError }}
          <button type="button" class="ml-1 font-medium underline" @click="load()">Retry</button>
        </p>

        <div v-if="loading && !customers.length" class="space-y-2" role="status" aria-label="Loading customers">
          <div v-for="n in 4" :key="n" class="h-12 animate-pulse rounded-card bg-text-secondary/10" />
        </div>
        <EmptyState
          v-else-if="!loadError && !customers.length"
          :title="search ? 'No matching customers' : 'Every customer already has a router'"
          :description="search
            ? 'Try a different name, email or phone number.'
            : 'To move a device to someone, unallocate their current one first.'"
        />
        <ul v-else class="space-y-2" :class="loading ? 'opacity-60' : ''">
          <li v-for="customer in customers" :key="customer.id">
            <button
              type="button" :disabled="submitting"
              class="flex w-full items-center justify-between gap-3 rounded-card border px-3 py-2.5 text-left transition-colors disabled:opacity-50"
              :class="selectedId === customer.id
                ? 'border-secondary bg-secondary/10'
                : 'border-border hover:bg-text-secondary/10'"
              :aria-pressed="selectedId === customer.id"
              @click="selectedId = customer.id"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-text-primary">{{ customer.name }}</span>
                <span class="block truncate text-xs text-text-secondary">
                  {{ customer.email }}<span v-if="customer.phone_number"> · {{ customer.phone_number }}</span>
                </span>
              </span>
              <Check v-if="selectedId === customer.id" class="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />

        <!-- Unallocate (only meaningful for an allocated device) -->
        <div v-if="isReallocation" class="border-t border-border pt-4">
          <template v-if="!confirmingUnallocate">
            <p class="text-sm text-text-secondary">
              Or take it away from {{ lease.customer_name }} without giving it to anyone.
              It goes back to the "Needs allocation" list.
            </p>
            <button type="button" :disabled="submitting" class="btn-danger mt-2" @click="confirmingUnallocate = true">
              Unallocate this device
            </button>
          </template>
          <div v-else class="rounded-card border border-error/30 bg-error/5 p-3">
            <p class="text-sm text-text-primary">
              Unallocate this device from {{ lease.customer_name }}? Its internet access is not changed.
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" :disabled="submitting" class="btn-danger-solid" @click="submitUnallocate">
                {{ submitting ? 'Please wait…' : 'Yes, unallocate' }}
              </button>
              <button type="button" :disabled="submitting" class="btn-secondary" @click="confirmingUnallocate = false">Keep it</button>
            </div>
          </div>
        </div>

        <p v-if="actionError" role="alert" class="rounded-card border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
          {{ actionError }}
        </p>
      </div>

      <!-- Footer -->
      <div class="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
        <button type="button" :disabled="submitting" class="btn-secondary" @click="emit('close')">Cancel</button>
        <button type="button" :disabled="!selectedId || submitting" class="btn-primary" @click="submitAllocation">
          {{ submitting && !confirmingUnallocate ? 'Please wait…' : isReallocation ? 'Reallocate' : 'Allocate' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
import type { Plan } from '~/types/api/subscriptions'

const props = defineProps<{ open: boolean; plan: Plan | null }>()
const emit = defineEmits<{ close: []; saved: [plan: Plan]; deleted: [planId: string] }>()

const { updatePlan, deactivatePlan } = usePlansApi()
const { listCustomers } = useCustomersApi()

const form = reactive({
  name: '', description: '', duration_days: 30, price: '', is_active: true,
  plan_type: 'GENERAL' as 'GENERAL' | 'SPECIFIC',
})
const eligibleIds = ref<string[]>([])
const eligibleLabels = reactive<Record<string, string>>({})
const saving = ref(false); const formError = ref('')
const confirmDeleteOpen = ref(false); const deleting = ref(false)

const customerSearch = ref('')
const { data: customerResults } = await useAsyncData(
  'plan-modal-customer-search',
  () => customerSearch.value.length >= 2 ? listCustomers({ search: customerSearch.value, page_size: 10 }) : Promise.resolve(null),
  { watch: [customerSearch] },
)
const customerOptions = computed(() => (customerResults.value?.results ?? []).filter((c) => !eligibleIds.value.includes(c.id)))

watch(() => props.plan, (plan) => {
  if (!plan) return
  form.name = plan.name; form.description = plan.description; form.duration_days = plan.duration_days
  form.price = plan.price; form.is_active = plan.is_active; form.plan_type = plan.plan_type
  eligibleIds.value = plan.eligible_customers.map((c) => c.id)
  plan.eligible_customers.forEach((c) => { eligibleLabels[c.id] = `${c.name} · ${c.email}` })
  formError.value = ''; customerSearch.value = ''
}, { immediate: true })

function addEligible(id: string, label: string) {
  eligibleIds.value.push(id); eligibleLabels[id] = label; customerSearch.value = ''
}
function removeEligible(id: string) {
  eligibleIds.value = eligibleIds.value.filter((existing) => existing !== id)
}

function handleClose() {
  if (saving.value || deleting.value) return
  emit('close')
}

async function handleSave() {
  if (!props.plan) return
  formError.value = ''
  if (form.plan_type === 'SPECIFIC' && !eligibleIds.value.length) {
    formError.value = 'Add at least one eligible customer, or switch this plan to General.'
    return
  }
  saving.value = true
  try {
    const updated = await updatePlan(props.plan.id, {
      name: form.name, description: form.description, duration_days: form.duration_days,
      price: form.price, is_active: form.is_active, plan_type: form.plan_type,
      eligible_customer_ids: form.plan_type === 'SPECIFIC' ? eligibleIds.value : [],
    })
    emit('saved', updated)
  } catch { formError.value = "Couldn't save these changes. Check the fields and try again." }
  finally { saving.value = false }
}

// "Delete" here is the soft-delete/restore action, not a hard removal -
// per the system's soft-delete policy, this plan's history (past
// subscriptions/payments referencing it) stays intact and an admin can
// restore it later; it just drops out of the active plan listings.
async function handleDelete() {
  if (!props.plan) return
  deleting.value = true
  try { await deactivatePlan(props.plan.id); emit('deleted', props.plan.id) }
  finally { deleting.value = false; confirmDeleteOpen.value = false }
}

// Escape-to-close and a body-scroll lock while open, matching how a
// stable/native-feeling modal should behave - without these, the page
// behind it keeps scrolling and there's no keyboard way out.
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') handleClose()
}
watch(() => props.open, (isOpen) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = isOpen ? 'hidden' : ''
  if (isOpen) window.addEventListener('keydown', handleKeydown)
  else window.removeEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
  window.removeEventListener('keydown', handleKeydown)
})
</script>
<template>
  <Transition enter-active-class="transition-opacity duration-150" leave-active-class="transition-opacity duration-100" enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div v-if="props.open && props.plan" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" @mousedown.self="handleClose">
      <div class="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-card border border-border bg-surface shadow-xl" role="dialog" aria-modal="true" aria-labelledby="plan-modal-title">
        <div class="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id="plan-modal-title" class="text-base font-semibold text-text-primary">Plan details</h2>
            <p class="text-xs text-text-secondary">{{ props.plan.name }}</p>
          </div>
          <button type="button" class="rounded-card p-1.5 text-text-secondary transition-colors hover:bg-text-secondary/10 hover:text-text-primary" aria-label="Close" @click="handleClose"><X class="h-4 w-4" /></button>
        </div>
        <form id="plan-modal-form" class="flex-1 space-y-4 overflow-y-auto px-5 py-4" @submit.prevent="handleSave">
          <div>
            <label class="mb-1 block text-sm font-medium text-text-primary">Name</label>
            <input v-model="form.name" required class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent">
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-text-primary">Price</label>
              <input v-model="form.price" required type="number" step="0.01" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent">
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-text-primary">Duration (days)</label>
              <input v-model.number="form.duration_days" required type="number" min="1" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent">
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-text-primary">Description</label>
            <textarea v-model="form.description" rows="2" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent" />
          </div>
          <label class="flex items-center gap-2 text-sm text-text-primary">
            <input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-border accent-secondary">
            Available for purchase
          </label>
          <div>
            <label class="mb-1 block text-sm font-medium text-text-primary">Plan type</label>
            <select v-model="form.plan_type" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent">
              <option value="GENERAL">General - available to any customer</option>
              <option value="SPECIFIC">Specific - only listed customers</option>
            </select>
          </div>
          <div v-if="form.plan_type === 'SPECIFIC'" class="space-y-2 rounded-card border border-border bg-background/40 p-3">
            <p class="text-sm font-medium text-text-primary">Eligible customers</p>
            <ul v-if="eligibleIds.length" class="space-y-1.5">
              <li v-for="id in eligibleIds" :key="id" class="flex items-center justify-between gap-2 rounded-card bg-surface px-2.5 py-1.5 text-sm">
                <span class="truncate text-text-primary">{{ eligibleLabels[id] }}</span>
                <button type="button" class="shrink-0 text-xs font-medium text-error hover:underline" @click="removeEligible(id)">Remove</button>
              </li>
            </ul>
            <p v-else class="text-xs text-text-secondary">No customers added yet.</p>
            <SearchInput v-model="customerSearch" placeholder="Search customers to add…" />
            <div v-if="customerOptions.length" class="max-h-32 overflow-y-auto rounded-card border border-border bg-surface">
              <button
                v-for="c in customerOptions" :key="c.id" type="button"
                class="block w-full px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-text-secondary/10"
                @click="addEligible(c.id, `${c.user.first_name} ${c.user.last_name} · ${c.user.email}`)">
                {{ c.user.first_name }} {{ c.user.last_name }} · {{ c.user.email }}
              </button>
            </div>
          </div>
          <p v-if="formError" role="alert" class="text-sm text-error">{{ formError }}</p>
        </form>
        <div class="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" class="btn-danger" @click="confirmDeleteOpen = true">Delete plan</button>
          <div class="flex gap-2">
            <button type="button" class="btn-secondary flex-1 sm:flex-none" @click="handleClose">Cancel</button>
            <button type="submit" form="plan-modal-form" :disabled="saving" class="btn-primary flex-1 sm:flex-none">{{ saving ? 'Saving…' : 'Save changes' }}</button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
  <ConfirmationDialog :open="confirmDeleteOpen" title="Delete this plan?" description="It'll be hidden from active listings, but past subscriptions/payments that used it stay intact and it can be restored later." confirm-label="Delete" danger @confirm="handleDelete" @cancel="confirmDeleteOpen = false" />
</template>
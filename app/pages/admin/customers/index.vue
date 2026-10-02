<script setup lang="ts">
import { Users } from 'lucide-vue-next'
definePageMeta({ layout: 'admin' })
const { listCustomers, createCustomer } = useCustomersApi()
const route = useRoute()
const search = ref('')
// Initialized from the query string so /admin/customers?status=SUSPENDED
// (e.g. the "Suspended Customers" dashboard card) lands already filtered,
// rather than requiring a second manual click on this page.
const statusFilter = ref((route.query.status as string) ?? '')
const typeFilter = ref('')
const page = ref(1)
const queryParams = computed(() => {
  const params: Record<string, string | number> = { page: page.value, page_size: 20 }
  if (search.value) params.search = search.value
  if (statusFilter.value) params.status = statusFilter.value
  if (typeFilter.value) params.customer_type = typeFilter.value
  return params
})
const { data, pending, error, refresh } = await useAsyncData('admin-customers', () => listCustomers(queryParams.value), { watch: [queryParams] })
const customers = computed(() => data.value?.results ?? [])
const totalPages = computed(() => data.value?.total_pages ?? 1)
function handleRowClick(row: Record<string, any>) { navigateTo(`/admin/customers/${row.id}`) }

const showCreateForm = ref(false)
const creating = ref(false)
const createError = ref('')
const form = reactive({
  email: '', first_name: '', last_name: '', password: '',
  phone_number: '', address: '', city: '', country: '', router_ip: '',
  customer_type: 'RESIDENTIAL' as 'RESIDENTIAL' | 'BUSINESS', company_name: '', alternate_phone: '', landmark: '',
})
async function handleCreate() {
  creating.value = true
  createError.value = ''
  try {
    await createCustomer({ ...form, router_ip: form.router_ip || null })
    showCreateForm.value = false
    Object.assign(form, {
      email: '', first_name: '', last_name: '', password: '', phone_number: '', address: '', city: '', country: '', router_ip: '',
      customer_type: 'RESIDENTIAL', company_name: '', alternate_phone: '', landmark: '',
    })
    await refresh()
  } catch (err) {
    createError.value = apiErrorMessage(err, 'Could not create customer - check the details and try again.')
  } finally {
    creating.value = false
  }
}
</script>
<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-text-primary">Customers</h1>
      <button type="button" class="btn-primary" @click="showCreateForm = !showCreateForm">
        {{ showCreateForm ? 'Cancel' : 'New Customer' }}
      </button>
    </div>
    <form v-if="showCreateForm" class="grid grid-cols-1 gap-3 rounded-card border border-border bg-surface p-5 sm:grid-cols-2" @submit.prevent="handleCreate">
      <input v-model="form.first_name" placeholder="First name" required class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
      <input v-model="form.last_name" placeholder="Last name" required class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
      <input v-model="form.email" type="email" placeholder="Email" required class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
      <input v-model="form.password" type="password" placeholder="Temporary password" required class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
      <input v-model="form.phone_number" placeholder="Phone (optional)" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
      <input v-model="form.router_ip" placeholder="Router IP (optional - filled in later if unknown)" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
      <input v-model="form.address" placeholder="Address (optional)" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
      <input v-model="form.city" placeholder="City (optional)" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
      <input v-model="form.country" placeholder="Country (optional)" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
      <select v-model="form.customer_type" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <option value="RESIDENTIAL">Residential customer</option>
        <option value="BUSINESS">Business customer</option>
      </select>
      <input v-if="form.customer_type === 'BUSINESS'" v-model="form.company_name" placeholder="Company name" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
      <input v-model="form.alternate_phone" placeholder="Alternate phone (optional)" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
      <input v-model="form.landmark" placeholder="Landmark / how to find the premises (optional)" class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent sm:col-span-2">
      <p v-if="createError" class="text-xs text-error sm:col-span-2">{{ createError }}</p>
      <button type="submit" :disabled="creating" class="btn-primary sm:col-span-2">{{ creating ? 'Creating…' : 'Create customer' }}</button>
    </form>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <SearchInput v-model="search" placeholder="Search by name, email, phone, company or router MAC…" class="sm:max-w-sm" />
      <select v-model="statusFilter" class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="SUSPENDED">Suspended</option>
      </select>
      <select v-model="typeFilter" class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <option value="">All types</option>
        <option value="RESIDENTIAL">Residential</option>
        <option value="BUSINESS">Business</option>
      </select>
    </div>
    <LoadingState v-if="pending" :rows="6" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!customers.length" :icon="Users" title="No customers found" />
    <template v-else>
      <DataTable :columns="[{key:'name',label:'Customer'},{key:'contact',label:'Contact'},{key:'location',label:'Location'},{key:'device',label:'Device'},{key:'plan',label:'Plan'},{key:'router',label:'Router'},{key:'status',label:'Account'},{key:'registered',label:'Registered'}]" :rows="customers" row-key="id" @row-click="handleRowClick">
        <template #cell-name="{ row }">
          <div class="font-medium">{{ row.user.first_name }} {{ row.user.last_name }}</div>
          <div class="text-xs text-text-secondary">
            {{ row.customer_type === 'BUSINESS' ? (row.company_name ? `Business · ${row.company_name}` : 'Business') : 'Residential' }}
          </div>
        </template>
        <template #cell-contact="{ row }">
          <div>{{ row.user.email }}</div>
          <div class="text-xs text-text-secondary">{{ row.user.phone_number || 'No phone on file' }}</div>
        </template>
        <template #cell-location="{ row }">
          <div>{{ [row.city, row.country].filter(Boolean).join(', ') || '—' }}</div>
          <div v-if="row.landmark" class="max-w-[14rem] truncate text-xs text-text-secondary" :title="row.landmark">{{ row.landmark }}</div>
        </template>
        <!-- The customer's radio at a glance: picture follows the detected model. -->
        <template #cell-device="{ row }">
          <div v-if="row.device_count" class="flex items-center gap-2">
            <DeviceIcon :icon-id="row.primary_device_icon_id" :title="row.primary_device_product_name || row.primary_device_model || ''" />
            <div>
              <div class="text-sm">{{ row.primary_device_product_name || row.primary_device_model || 'Model not detected' }}</div>
              <div v-if="row.device_count > 1" class="text-xs text-text-secondary">+{{ row.device_count - 1 }} more</div>
            </div>
          </div>
          <span v-else class="text-text-secondary">No device</span>
        </template>
        <template #cell-plan="{ row }">
          <div v-if="row.subscription_status === 'ACTIVE'">
            <div>{{ row.plan_name }}</div>
            <div class="text-xs text-text-secondary">until {{ formatDate(row.subscription_ends_at) }}</div>
          </div>
          <StatusBadge v-else-if="row.subscription_status === 'BLOCKED'" label="Blocked" tone="error" />
          <StatusBadge v-else-if="row.subscription_status === 'EXPIRED'" label="Expired" tone="neutral" />
          <span v-else class="text-text-secondary">No plan</span>
        </template>
        <template #cell-router="{ row }">
          <span v-if="row.router_online == null" class="text-text-secondary">Not allocated</span>
          <span v-else class="inline-flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full" :class="row.router_online ? 'bg-success' : 'bg-text-secondary/40'" />
            {{ row.router_online ? 'Online' : 'Offline' }}
          </span>
        </template>
        <template #cell-status="{ row }"><StatusBadge :label="row.status" :tone="row.status === 'ACTIVE' ? 'success' : 'error'" /></template>
        <template #cell-registered="{ row }">{{ formatDate(row.registration_date) }}</template>
      </DataTable>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
  </div>
</template>
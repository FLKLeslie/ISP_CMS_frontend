<script setup lang="ts">
import { Users } from 'lucide-vue-next'
definePageMeta({ layout: 'admin' })
const { listCustomers } = useCustomersApi()
const route = useRoute()
const search = ref('')
// Initialized from the query string so /admin/customers?status=SUSPENDED
// (e.g. the "Suspended Customers" dashboard card) lands already filtered,
// rather than requiring a second manual click on this page.
const statusFilter = ref((route.query.status as string) ?? '')
const page = ref(1)
const queryParams = computed(() => {
  const params: Record<string, string | number> = { page: page.value, page_size: 20 }
  if (search.value) params.search = search.value
  if (statusFilter.value) params.status = statusFilter.value
  return params
})
const { data, pending, error, refresh } = await useAsyncData('admin-customers', () => listCustomers(queryParams.value), { watch: [queryParams] })
const customers = computed(() => data.value?.results ?? [])
const totalPages = computed(() => data.value?.total_pages ?? 1)
function handleRowClick(row: Record<string, any>) { navigateTo(`/admin/customers/${row.id}`) }
</script>
<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">Customers</h1>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <SearchInput v-model="search" placeholder="Search by name or email…" class="sm:max-w-xs" />
      <select v-model="statusFilter" class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="SUSPENDED">Suspended</option>
      </select>
    </div>
    <LoadingState v-if="pending" :rows="6" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!customers.length" :icon="Users" title="No customers found" />
    <template v-else>
      <DataTable :columns="[{key:'name',label:'Name'},{key:'email',label:'Email'},{key:'location',label:'Location'},{key:'status',label:'Status'},{key:'registered',label:'Registered'}]" :rows="customers" row-key="id" @row-click="handleRowClick">
        <template #cell-name="{ row }">{{ row.user.first_name }} {{ row.user.last_name }}</template>
        <template #cell-email="{ row }">{{ row.user.email }}</template>
        <template #cell-location="{ row }">{{ [row.city, row.country].filter(Boolean).join(', ') || '—' }}</template>
        <template #cell-status="{ row }"><StatusBadge :label="row.status" :tone="row.status === 'ACTIVE' ? 'success' : 'error'" /></template>
        <template #cell-registered="{ row }">{{ formatDate(row.registration_date) }}</template>
      </DataTable>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
  </div>
</template>
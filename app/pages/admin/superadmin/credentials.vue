<script setup lang="ts">
// SUPER ADMINISTRATOR ONLY. Every customer's username (their email), what state their password
// is in, and the two things that can be done about it:
//
//   * look at the stored HASH of the password, if you want to (hidden until you tap Show);
//   * reset the password to the default - behind a three-step confirmation, and the customer is
//     then forced to choose a new one at their next sign-in.
//
// A password cannot be read back: it is stored one-way. (That is deliberate - see the handover.)
// Every look at a hash and every reset is recorded in the audit log under the super administrator's name.
import { KeyRound } from 'lucide-vue-next'
import type { CustomerCredential, PasswordResetResult } from '~/types/api/superadmin'

definePageMeta({ layout: 'admin' })
const { listCustomerCredentials, resetCustomerPassword } = useSuperAdminApi()

const search = ref('')
const page = ref(1)
watch(search, () => { page.value = 1 })
const queryParams = computed(() => {
  const params: Record<string, string | number> = { page: page.value, page_size: 20 }
  if (search.value) params.search = search.value
  return params
})
const { data, pending, error, refresh } = await useAsyncData('superadmin-customer-accounts', () => listCustomerCredentials(queryParams.value), { watch: [queryParams] })
const rows = computed(() => data.value?.results ?? [])
const totalPages = computed(() => data.value?.total_pages ?? 1)

const resetting = ref<CustomerCredential | null>(null)
const lastReset = ref<{ name: string; email: string; result: PasswordResetResult } | null>(null)
const fullName = (row: CustomerCredential) => `${row.first_name} ${row.last_name}`.trim() || row.email

async function submitReset(payload: Parameters<typeof resetCustomerPassword>[1]) {
  return resetCustomerPassword((resetting.value as CustomerCredential).user_uuid, payload)
}
async function onReset(result: PasswordResetResult) {
  if (resetting.value) lastReset.value = { name: fullName(resetting.value), email: resetting.value.email, result }
  resetting.value = null
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-text-primary">Customer Accounts</h1>
      <p class="mt-1 max-w-2xl text-sm text-text-secondary">
        View user account details and reset their passwords
      </p>
    </div>

    <div v-if="lastReset" role="status" class="rounded-card border border-success/30 bg-success/5 px-4 py-3 text-sm text-text-primary">
      <p>
        <strong>{{ lastReset.name }}</strong> ({{ lastReset.email }}) has been reset. Tell them their temporary password is
        <code class="rounded bg-text-secondary/10 px-1.5 py-0.5 font-semibold">{{ lastReset.result.default_password }}</code>.
        They will be asked to choose a new one when they sign in, and are signed out everywhere else.
      </p>
      <button type="button" class="mt-2 text-xs font-medium text-accent hover:underline" @click="lastReset = null">Dismiss</button>
    </div>

    <SearchInput v-model="search" placeholder="Search by name, email or phone…" class="sm:max-w-sm" />

    <LoadingState v-if="pending" :rows="6" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!rows.length" :icon="KeyRound" title="No customers found" />
    <template v-else>
      <DataTable
        :columns="[{key:'customer',label:'Customer'},{key:'username',label:'Username'},{key:'password',label:'Password'},{key:'state',label:'State'},{key:'login',label:'Last sign-in'},{key:'details',label:'Account details'},{key:'actions',label:''}]"
        :rows="rows" row-key="id"
      >
        <template #cell-customer="{ row }">
          <span class="font-medium text-text-primary">{{ fullName(row) }}</span>
          <span v-if="row.phone_number" class="block text-xs text-text-secondary">{{ row.phone_number }}</span>
        </template>
        <template #cell-username="{ row }"><span class="break-all">{{ row.email }}</span></template>
        <template #cell-password="{ row }"><PasswordStatus :must-change="row.must_change_password" /></template>
        <template #cell-state="{ row }">
          <div class="flex flex-wrap gap-1">
            <StatusBadge :label="row.status === 'ACTIVE' ? 'Active' : 'Suspended'" :tone="row.status === 'ACTIVE' ? 'success' : 'warning'" />
            <StatusBadge v-if="row.must_change_password" label="Must change password" tone="info" />
            <StatusBadge v-if="!row.is_active" label="Login disabled" tone="error" />
          </div>
        </template>
        <template #cell-login="{ row }">{{ row.last_login ? formatDateTime(row.last_login) : 'Never' }}</template>
        <template #cell-details="{ row }">
          <details class="min-w-40">
            <summary class="cursor-pointer text-xs font-medium text-accent">View account</summary>
            <dl class="mt-2 grid grid-cols-1 gap-1 text-xs text-text-secondary">
              <div><dt class="inline font-medium">Phone:</dt> <dd class="inline">{{ row.phone_number || '—' }}</dd></div>
              <div><dt class="inline font-medium">Type:</dt> <dd class="inline">{{ row.customer_type || '—' }}</dd></div>
              <div><dt class="inline font-medium">Company:</dt> <dd class="inline">{{ row.company_name || '—' }}</dd></div>
              <div><dt class="inline font-medium">Address:</dt> <dd class="inline">{{ [row.address, row.landmark, row.city, row.country].filter(Boolean).join(', ') || '—' }}</dd></div>
              <div><dt class="inline font-medium">Router:</dt> <dd class="inline">{{ [row.router_hostname, row.router_ip, row.router_mac_address].filter(Boolean).join(' · ') || '—' }}</dd></div>
              <div><dt class="inline font-medium">Alternate phone:</dt> <dd class="inline">{{ row.alternate_phone || '—' }}</dd></div>
              <div><dt class="inline font-medium">Registered:</dt> <dd class="inline">{{ row.registration_date || '—' }}</dd></div>
              <div v-if="row.notes"><dt class="inline font-medium">Internal notes:</dt> <dd class="inline">{{ row.notes }}</dd></div>
            </dl>
          </details>
        </template>
        <template #cell-actions="{ row }">
          <button type="button" class="btn-action-warning" @click="resetting = row">Reset to default</button>
        </template>
      </DataTable>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>

    <PasswordResetModal
      :open="!!resetting" kind="customer"
      :target-name="resetting ? fullName(resetting) : ''" :target-email="resetting?.email ?? ''"
      :submit="submitReset" @done="onReset" @cancel="resetting = null"
    />
  </div>
</template>

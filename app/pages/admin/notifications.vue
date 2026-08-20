<script setup lang="ts">
import { Bell } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

const { listNotifications, sendNotification } = useNotificationsApi()
const { listCustomers } = useCustomersApi()

const page = ref(1)
const typeFilter = ref('')

const listParams = computed(() => {
  const params: Record<string, string | number> = { page: page.value, page_size: 20 }
  if (typeFilter.value) params.type = typeFilter.value
  return params
})

const { data, pending, error, refresh } = await useAsyncData(
  'admin-notifications',
  () => listNotifications(listParams.value),
  { watch: [listParams] },
)
const notifications = computed(() => data.value?.results ?? [])
const totalPages = computed(() => data.value?.total_pages ?? 1)

function typeTone(type: string) {
  if (type === 'SUBSCRIPTION') return 'info'
  if (type === 'PAYMENT') return 'success'
  if (type === 'ANNOUNCEMENT') return 'warning'
  return 'neutral' // GENERAL
}

// --- Send-notification form -------------------------------------------------
// Same customer search+pick pattern as the Payments page — kept
// independent here (rather than a shared component) since the two forms'
// surrounding fields are different enough that a shared component would
// need more props/slots than it'd save in code.
const showForm = ref(false)

const customerSearch = ref('')
const { data: customerResults } = await useAsyncData(
  'admin-notifications-customer-search',
  () => customerSearch.value.length >= 2
    ? listCustomers({ search: customerSearch.value, page_size: 10 })
    : Promise.resolve(null),
  { watch: [customerSearch] },
)
const customerOptions = computed(() => customerResults.value?.results ?? [])
const selectedCustomerId = ref('')
const selectedCustomerLabel = ref('')

const title = ref('')
const message = ref('')
const type = ref<'SUBSCRIPTION' | 'PAYMENT' | 'ANNOUNCEMENT' | 'GENERAL'>('GENERAL')
const sending = ref(false)
const formError = ref('')

async function handleSend() {
  formError.value = ''
  if (!selectedCustomerId.value) {
    formError.value = 'Pick a customer to notify first.'
    return
  }
  sending.value = true
  try {
    await sendNotification({
      customer: selectedCustomerId.value,
      title: title.value,
      message: message.value,
      type: type.value,
    })
    title.value = ''
    message.value = ''
    selectedCustomerId.value = ''
    customerSearch.value = ''
    showForm.value = false
    await refresh()
  } catch {
    formError.value = "Couldn't send this notification. Check the fields and try again."
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-text-primary">Notifications</h1>
      <button
        type="button"
        class="rounded-card bg-secondary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        @click="showForm = !showForm"
      >
        {{ showForm ? 'Cancel' : 'Send Notification' }}
      </button>
    </div>

    <form
      v-if="showForm"
      class="space-y-4 rounded-card border border-border bg-surface p-5"
      @submit.prevent="handleSend"
    >
      <div>
        <label class="mb-1 block text-sm font-medium text-text-primary">Customer</label>
        <SearchInput v-model="customerSearch" placeholder="Search by name or email…" />
        <div v-if="customerOptions.length" class="mt-2 max-h-40 overflow-y-auto rounded-card border border-border">
          <button
            v-for="c in customerOptions"
            :key="c.id"
            type="button"
            class="block w-full px-3 py-2 text-left text-sm hover:bg-text-secondary/10"
            :class="selectedCustomerId === c.id ? 'bg-accent/10 text-accent' : 'text-text-primary'"
            @click="selectedCustomerId = c.id; selectedCustomerLabel = `${c.user.first_name} ${c.user.last_name}`; customerSearch = selectedCustomerLabel"
          >
            {{ c.user.first_name }} {{ c.user.last_name }} — {{ c.user.email }}
          </button>
        </div>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-text-primary">Type</label>
        <select
          v-model="type"
          class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent sm:w-64"
        >
          <option value="GENERAL">General</option>
          <option value="SUBSCRIPTION">Subscription</option>
          <option value="PAYMENT">Payment</option>
          <option value="ANNOUNCEMENT">Announcement</option>
        </select>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-text-primary">Title</label>
        <input
          v-model="title"
          required
          class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        />
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-text-primary">Message</label>
        <textarea
          v-model="message"
          required
          rows="3"
          class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        />
      </div>

      <p v-if="formError" role="alert" class="text-sm text-error">{{ formError }}</p>

      <button
        type="submit"
        :disabled="sending"
        class="rounded-card bg-secondary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {{ sending ? 'Sending…' : 'Send Notification' }}
      </button>
    </form>

    <select
      v-model="typeFilter"
      class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
    >
      <option value="">All types</option>
      <option value="SUBSCRIPTION">Subscription</option>
      <option value="PAYMENT">Payment</option>
      <option value="ANNOUNCEMENT">Announcement</option>
      <option value="GENERAL">General</option>
    </select>

    <LoadingState v-if="pending" :rows="6" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!notifications.length" :icon="Bell" title="No notifications sent yet" />
    <template v-else>
      <DataTable
        :columns="[
          { key: 'customer', label: 'Customer' },
          { key: 'title', label: 'Title' },
          { key: 'type', label: 'Type' },
          { key: 'sent', label: 'Sent' },
          { key: 'read', label: 'Read' },
        ]"
        :rows="notifications"
        row-key="id"
      >
        <template #cell-customer="{ row }">{{ row.customer_name }}</template>
        <template #cell-type="{ row }">
          <StatusBadge :label="row.type" :tone="typeTone(row.type)" />
        </template>
        <template #cell-sent="{ row }">{{ formatDateTime(row.created_at) }}</template>
        <template #cell-read="{ row }">
          <span :class="row.is_read ? 'text-text-secondary' : 'font-medium text-text-primary'">
            {{ row.is_read ? 'Read' : 'Unread' }}
          </span>
        </template>
      </DataTable>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
  </div>
</template>
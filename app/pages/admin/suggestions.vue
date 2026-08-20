<script setup lang="ts">
import { MessageSquare } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

const { listSuggestions, respondToSuggestion } = useSuggestionsApi()

const page = ref(1)
const statusFilter = ref('')
const categoryFilter = ref('')

const listParams = computed(() => {
  const params: Record<string, string | number> = { page: page.value, page_size: 20 }
  if (statusFilter.value) params.status = statusFilter.value
  if (categoryFilter.value) params.category = categoryFilter.value
  return params
})

const { data, pending, error, refresh } = await useAsyncData(
  'admin-suggestions',
  () => listSuggestions(listParams.value),
  { watch: [listParams] },
)
const suggestions = computed(() => data.value?.results ?? [])
const totalPages = computed(() => data.value?.total_pages ?? 1)

function statusTone(status: string) {
  if (status === 'RESPONDED' || status === 'CLOSED') return 'success'
  if (status === 'REVIEWED') return 'info'
  return 'warning' // PENDING
}

// --- Respond panel ---------------------------------------------------------
// One suggestion is "open" for responding at a time, shown inline below its
// row rather than a separate page — keeps the admin in the list context,
// which matters here since responding is usually a quick, frequent action.
const openId = ref<string | null>(null)
const responseText = ref('')
const responseStatus = ref<'RESPONDED' | 'CLOSED'>('RESPONDED')
const sending = ref(false)
const sendError = ref('')

function openResponse(row: { id: string; admin_response: string }) {
  openId.value = openId.value === row.id ? null : row.id
  responseText.value = row.admin_response || ''
  sendError.value = ''
}

async function handleRespond(id: string) {
  if (!responseText.value.trim()) {
    sendError.value = 'Write a response before sending.'
    return
  }
  sendError.value = ''
  sending.value = true
  try {
    await respondToSuggestion(id, responseText.value, responseStatus.value)
    openId.value = null
    responseText.value = ''
    await refresh()
  } catch {
    sendError.value = "Couldn't send the response. Try again."
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">Suggestions</h1>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <select
        v-model="statusFilter"
        class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option value="">All statuses</option>
        <option value="PENDING">Pending</option>
        <option value="REVIEWED">Reviewed</option>
        <option value="RESPONDED">Responded</option>
        <option value="CLOSED">Closed</option>
      </select>
      <select
        v-model="categoryFilter"
        class="rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      >
        <option value="">All categories</option>
        <option value="SUGGESTION">Suggestion</option>
        <option value="COMPLAINT">Complaint</option>
        <option value="COMPLIMENT">Compliment</option>
        <option value="SUPPORT">Support</option>
      </select>
    </div>

    <LoadingState v-if="pending" :rows="6" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!suggestions.length" :icon="MessageSquare" title="No suggestions found" />
    <template v-else>
      <div class="space-y-3">
        <div
          v-for="s in suggestions"
          :key="s.id"
          class="rounded-card border border-border bg-surface p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="text-sm font-semibold text-text-primary">{{ s.subject }}</p>
              <p class="text-xs text-text-secondary">
                {{ s.customer_name }} · {{ s.category }} · {{ formatDateTime(s.created_at) }}
              </p>
            </div>
            <StatusBadge :label="s.status" :tone="statusTone(s.status)" />
          </div>
          <p class="mt-2 text-sm text-text-primary">{{ s.message }}</p>

          <div v-if="s.admin_response" class="mt-3 rounded-card bg-background p-3">
            <p class="text-xs font-medium text-text-secondary">Your response</p>
            <p class="mt-1 text-sm text-text-primary">{{ s.admin_response }}</p>
          </div>

          <button
            type="button"
            class="mt-3 text-sm font-medium text-accent hover:underline"
            @click="openResponse(s)"
          >
            {{ openId === s.id ? 'Cancel' : s.admin_response ? 'Edit response' : 'Respond' }}
          </button>

          <div v-if="openId === s.id" class="mt-3 space-y-3 border-t border-border pt-3">
            <textarea
              v-model="responseText"
              rows="3"
              placeholder="Write your response…"
              class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
            <div class="flex flex-wrap items-center gap-3">
              <select
                v-model="responseStatus"
                class="rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              >
                <option value="RESPONDED">Mark as Responded</option>
                <option value="CLOSED">Mark as Closed</option>
              </select>
              <button
                type="button"
                :disabled="sending"
                class="rounded-card bg-secondary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                @click="handleRespond(s.id)"
              >
                {{ sending ? 'Sending…' : 'Send Response' }}
              </button>
            </div>
            <p v-if="sendError" role="alert" class="text-sm text-error">{{ sendError }}</p>
          </div>
        </div>
      </div>
      <Pagination :current-page="page" :total-pages="totalPages" @change="page = $event" />
    </template>
  </div>
</template>
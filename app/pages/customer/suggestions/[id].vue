<script setup lang="ts">
definePageMeta({ layout: 'customer' })
const route = useRoute()
const id = route.params.id as string
const { fetchSuggestion, updateSuggestion, deleteSuggestion } = useSuggestionsApi()
const { data: suggestion, pending, error, refresh } = await useAsyncData(`suggestion-${id}`, () => fetchSuggestion(id))
const statusTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = { PENDING: 'neutral', REVIEWED: 'warning', RESPONDED: 'success', CLOSED: 'neutral' }

// The backend only allows editing/deleting while status is still PENDING
// (i.e. no administrator has opened it yet) - this just mirrors that so
// the buttons aren't shown when they'd fail; the real enforcement is
// server-side (see SuggestionPermission on the backend).
const canEdit = computed(() => suggestion.value?.status === 'PENDING')

const editing = ref(false)
const subjectDraft = ref('')
const messageDraft = ref('')
const saving = ref(false)
const saveError = ref('')

function startEdit() {
  if (!suggestion.value) return
  subjectDraft.value = suggestion.value.subject
  messageDraft.value = suggestion.value.message
  saveError.value = ''
  editing.value = true
}

async function handleSave() {
  saving.value = true
  saveError.value = ''
  try {
    suggestion.value = await updateSuggestion(id, { subject: subjectDraft.value, message: messageDraft.value })
    editing.value = false
  } catch {
    saveError.value = 'Could not save - this suggestion may already have been reviewed.'
  } finally {
    saving.value = false
  }
}

const confirmDeleteOpen = ref(false)
const deleting = ref(false)
async function handleDelete() {
  deleting.value = true
  try {
    await deleteSuggestion(id)
    await navigateTo('/customer/suggestions')
  } finally {
    deleting.value = false
    confirmDeleteOpen.value = false
  }
}
</script>
<template>
  <div class="max-w-2xl space-y-6">
    <NuxtLink to="/customer/suggestions" class="text-sm text-text-secondary hover:text-text-primary">← Back to Suggestions</NuxtLink>
    <LoadingState v-if="pending" :rows="3" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <template v-else-if="suggestion">
      <div class="flex items-start justify-between gap-4">
        <h1 class="text-xl font-semibold text-text-primary">{{ suggestion.subject }}</h1>
        <StatusBadge :label="suggestion.status" :tone="statusTone[suggestion.status] ?? 'neutral'" />
      </div>

      <div v-if="canEdit && !editing" class="flex gap-2">
        <button type="button" class="rounded-card border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-text-secondary/10" @click="startEdit">Edit</button>
        <button type="button" class="rounded-card border border-error/40 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10" @click="confirmDeleteOpen = true">Delete</button>
      </div>

      <form v-if="editing" class="space-y-3 rounded-card border border-border bg-surface p-5" @submit.prevent="handleSave">
        <div>
          <label class="mb-1 block text-xs font-medium text-text-secondary">Subject</label>
          <input v-model="subjectDraft" type="text" required class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text-secondary">Message</label>
          <textarea v-model="messageDraft" rows="4" required class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
        </div>
        <p v-if="saveError" class="text-xs text-error">{{ saveError }}</p>
        <div class="flex gap-2">
          <button type="submit" :disabled="saving" class="btn-primary">{{ saving ? 'Saving…' : 'Save changes' }}</button>
          <button type="button" class="rounded-card border border-border px-4 py-2 text-xs font-medium text-text-primary" @click="editing = false">Cancel</button>
        </div>
      </form>

      <div v-else class="rounded-card border border-border bg-surface p-5">
        <p class="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">Your message</p>
        <p class="text-sm text-text-primary">{{ suggestion.message }}</p>
        <p class="mt-3 text-xs text-text-secondary">{{ formatDateTime(suggestion.created_at) }}</p>
      </div>

      <div v-if="suggestion.admin_response" class="rounded-card border border-secondary/30 bg-secondary/5 p-5">
        <p class="mb-1 text-xs font-medium uppercase tracking-wide text-secondary">Response</p>
        <p class="text-sm text-text-primary">{{ suggestion.admin_response }}</p>
        <p v-if="suggestion.responded_at" class="mt-3 text-xs text-text-secondary">{{ formatDateTime(suggestion.responded_at) }}</p>
      </div>
      <EmptyState v-else title="No response yet" description="We'll notify you here once someone responds." />
    </template>
    <ConfirmationDialog :open="confirmDeleteOpen" title="Delete this suggestion?" description="This can't be undone." :confirm-label="deleting ? 'Please wait…' : 'Delete'" danger @confirm="handleDelete" @cancel="confirmDeleteOpen = false" />
  </div>
</template>

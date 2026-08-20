<script setup lang="ts">
import { MessageSquare } from 'lucide-vue-next'
import type { SuggestionCategory } from '~/types/api/customer-domain'
definePageMeta({ layout: 'customer' })
const { listSuggestions, createSuggestion } = useSuggestionsApi()
const { data, pending, error, refresh } = await useAsyncData('customer-suggestions', () => listSuggestions({ ordering: '-created_at' }))
const suggestions = computed(() => data.value?.results ?? [])
const showForm = ref(false); const subject = ref(''); const category = ref<SuggestionCategory>('SUGGESTION'); const message = ref('')
const submitting = ref(false); const submitError = ref('')
const categoryOptions: { value: SuggestionCategory; label: string }[] = [
  { value: 'SUGGESTION', label: 'Suggestion' }, { value: 'COMPLAINT', label: 'Complaint' }, { value: 'COMPLIMENT', label: 'Compliment' }, { value: 'SUPPORT', label: 'Support' },
]
const statusTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = { PENDING: 'neutral', REVIEWED: 'warning', RESPONDED: 'success', CLOSED: 'neutral' }
async function handleSubmit() {
  submitError.value = ''; submitting.value = true
  try {
    await createSuggestion({ subject: subject.value, category: category.value, message: message.value })
    subject.value = ''; message.value = ''; category.value = 'SUGGESTION'; showForm.value = false
    await refresh()
  } catch { submitError.value = "We couldn't submit this right now. Please try again." }
  finally { submitting.value = false }
}
</script>
<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-text-primary">Suggestions & Feedback</h1>
      <button type="button" class="rounded-card bg-secondary px-4 py-2 text-sm font-semibold text-white hover:opacity-90" @click="showForm = !showForm">{{ showForm ? 'Cancel' : 'New Submission' }}</button>
    </div>
    <form v-if="showForm" class="space-y-4 rounded-card border border-border bg-surface p-5" @submit.prevent="handleSubmit">
      <div>
        <label for="subject" class="mb-1 block text-sm font-medium text-text-primary">Subject</label>
        <input id="subject" v-model="subject" type="text" required class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
      </div>
      <div>
        <label for="category" class="mb-1 block text-sm font-medium text-text-primary">Category</label>
        <select id="category" v-model="category" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
          <option v-for="option in categoryOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </div>
      <div>
        <label for="message" class="mb-1 block text-sm font-medium text-text-primary">Message</label>
        <textarea id="message" v-model="message" required rows="4" class="w-full rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
      </div>
      <p v-if="submitError" role="alert" class="text-sm text-error">{{ submitError }}</p>
      <button type="submit" :disabled="submitting" class="rounded-card bg-secondary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{{ submitting ? 'Submitting…' : 'Submit' }}</button>
    </form>
    <LoadingState v-if="pending" :rows="4" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState v-else-if="!suggestions.length" :icon="MessageSquare" title="No submissions yet" description="Have feedback, a complaint, or a compliment? We'd like to hear it." />
    <ul v-else class="space-y-2">
      <li v-for="suggestion in suggestions" :key="suggestion.id">
        <NuxtLink :to="`/customer/suggestions/${suggestion.id}`" class="flex items-center justify-between gap-4 rounded-card border border-border bg-surface p-4 transition-colors hover:border-secondary/40">
          <div><p class="text-sm font-medium text-text-primary">{{ suggestion.subject }}</p><p class="mt-1 text-xs text-text-secondary">{{ formatRelativeTime(suggestion.created_at) }}</p></div>
          <StatusBadge :label="suggestion.status" :tone="statusTone[suggestion.status] ?? 'neutral'" />
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

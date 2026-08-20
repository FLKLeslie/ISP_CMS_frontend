<script setup lang="ts">
definePageMeta({ layout: 'customer' })
const route = useRoute()
const { fetchSuggestion } = useSuggestionsApi()
const { data: suggestion, pending, error, refresh } = await useAsyncData(`suggestion-${route.params.id}`, () => fetchSuggestion(route.params.id as string))
const statusTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = { PENDING: 'neutral', REVIEWED: 'warning', RESPONDED: 'success', CLOSED: 'neutral' }
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
      <div class="rounded-card border border-border bg-surface p-5">
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
  </div>
</template>

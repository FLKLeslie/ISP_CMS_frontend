<script setup lang="ts">
import { Wifi } from 'lucide-vue-next'
const props = defineProps<{ planName: string | null; remainingDays: number; expiryDate: string | null }>()
const emit = defineEmits<{ renew: [] }>()
const status = computed<{ label: string; tone: 'success' | 'warning' | 'error' | 'neutral' }>(() => {
  if (!props.planName) return { label: 'No Active Plan', tone: 'neutral' }
  if (props.remainingDays <= 0) return { label: 'Expired', tone: 'error' }
  if (props.remainingDays <= 7) return { label: 'Expiring Soon', tone: 'warning' }
  return { label: 'Active', tone: 'success' }
})
</script>
<template>
  <div class="rounded-card border border-border bg-surface p-6">
    <div class="mb-4 flex items-start justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-text-secondary">Current Plan</p>
        <h2 class="mt-1 text-2xl font-semibold text-text-primary">{{ props.planName ?? 'No plan selected' }}</h2>
      </div>
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary"><Wifi class="h-5 w-5" aria-hidden="true" /></div>
    </div>
    <div class="mb-5 flex flex-wrap items-center gap-3">
      <StatusBadge :label="status.label" :tone="status.tone" />
      <span v-if="props.planName" class="text-sm text-text-secondary">{{ formatRemainingDays(props.remainingDays) }}</span>
    </div>
    <p v-if="props.expiryDate" class="mb-5 text-sm text-text-secondary">Expires: <span class="font-medium text-text-primary">{{ formatDate(props.expiryDate) }}</span></p>
    <button type="button" class="rounded-card bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90" @click="emit('renew')">
      {{ props.planName ? 'Renew Plan' : 'Choose a Plan' }}
    </button>
  </div>
</template>

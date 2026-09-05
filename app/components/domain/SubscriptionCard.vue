<script setup lang="ts">
import { Wifi } from 'lucide-vue-next'
const props = withDefaults(
  defineProps<{
    planName: string | null
    remainingDays: number
    expiryDate: string | null
    expiresAt: string | null
    // Original plan length, used to work out how much of the bundle is
    // left as a percentage - drives whether the action button reads
    // "Duplicate bundle" (plenty of time left) or "Renew bundle" (running
    // low). Omit to just show a generic action (e.g. on the dashboard,
    // where the button is hidden anyway via showAction).
    durationDays?: number
    // The dashboard shows this card read-only (no action button) - the
    // subscription page is where renewing/duplicating actually happens.
    showAction?: boolean
    blocked?: boolean
  }>(),
  { showAction: true, blocked: false },
)
const emit = defineEmits<{ renew: [] }>()
const status = computed<{ label: string; tone: 'success' | 'warning' | 'error' | 'neutral' }>(() => {
  if (props.blocked) return { label: 'Blocked', tone: 'error' }
  if (!props.planName) return { label: 'No Active Plan', tone: 'neutral' }
  if (props.remainingDays <= 0) return { label: 'Expired', tone: 'error' }
  if (props.remainingDays <= 7) return { label: 'Expiring Soon', tone: 'warning' }
  return { label: 'Active', tone: 'success' }
})
// >70% of the bundle remaining -> plenty of room to stack another period
// ("Duplicate"). <30% remaining -> running low, frame it as renewing.
// The 30-70% middle ground defaults to "Renew" too, since that's the
// more broadly-applicable action once a bundle is more than a third
// spent.
const actionLabel = computed(() => {
  if (!props.planName) return 'Choose a Plan'
  if (!props.durationDays) return 'Renew or duplicate plan'
  const percentRemaining = (props.remainingDays / props.durationDays) * 100
  return percentRemaining > 70 ? 'Duplicate bundle' : 'Renew bundle'
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
      <span v-if="props.planName && !props.blocked" class="text-sm text-text-secondary">{{ formatRemainingDays(props.remainingDays) }}</span>
    </div>
    <p v-if="props.blocked" class="mb-5 text-sm text-error">Your internet access has been blocked. Please contact an administrator for more information.</p>
    <div v-else-if="props.expiresAt && props.remainingDays > 0" class="mb-5">
      <CountdownTimer :expires-at="props.expiresAt" />
    </div>
    <p v-if="props.expiryDate && !props.blocked" class="mb-5 text-sm text-text-secondary">Expires: <span class="font-medium text-text-primary">{{ formatDate(props.expiryDate) }}</span></p>
    <button v-if="props.showAction && !props.blocked" type="button" class="btn-primary" @click="emit('renew')">
      {{ actionLabel }}
    </button>
  </div>
</template>
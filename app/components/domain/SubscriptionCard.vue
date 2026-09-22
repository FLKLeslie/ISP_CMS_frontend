<script setup lang="ts">
import { Wifi } from 'lucide-vue-next'
const props = withDefaults(
  defineProps<{
    planName: string | null
    // Exact seconds until the plan ends. NOT whole days: a plan measured in
    // hours or minutes has 0 days left the entire time it is running.
    remainingSeconds: number
    // The exact moment it ends (ISO). Drives the live countdown and the
    // "Ends at" line.
    expiresAt: string | null
    // The plan's full length in minutes, used to work out how much of it is
    // left - drives whether the action reads "Duplicate bundle" (plenty left) or
    // "Renew bundle" (running low), and when it counts as "Expiring soon".
    durationMinutes?: number
    // The dashboard shows this card read-only (no action button) - the
    // subscription page is where renewing/duplicating actually happens.
    showAction?: boolean
    blocked?: boolean
  }>(),
  { showAction: true, blocked: false },
)
// `expired` fires when the countdown reaches zero, so the page can re-fetch and
// show the real state; `renew` is the action button.
const emit = defineEmits<{ renew: []; expired: [] }>()

const DAY = 86400
// "Expiring soon" scales with the plan: 7 days for a normal plan, but a quarter
// of the plan for a short one (7 days is longer than a 2-hour plan itself).
const soonSeconds = computed(() => {
  const plan = (props.durationMinutes ?? 0) * 60
  return plan > 0 ? Math.min(7 * DAY, plan / 4) : 7 * DAY
})
const status = computed<{ label: string; tone: 'success' | 'warning' | 'error' | 'neutral' }>(() => {
  if (props.blocked) return { label: 'Blocked', tone: 'error' }
  if (!props.planName) return { label: 'No Active Plan', tone: 'neutral' }
  if (props.remainingSeconds <= 0) return { label: 'Expired', tone: 'error' }
  if (props.remainingSeconds <= soonSeconds.value) return { label: 'Expiring Soon', tone: 'warning' }
  return { label: 'Active', tone: 'success' }
})
// >70% of the bundle remaining -> plenty of room to stack another period
// ("Duplicate"). Otherwise frame it as renewing.
const actionLabel = computed(() => {
  if (!props.planName) return 'Choose a Plan'
  if (!props.durationMinutes) return 'Renew or duplicate plan'
  const percentRemaining = (props.remainingSeconds / (props.durationMinutes * 60)) * 100
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
      <span v-if="props.planName && !props.blocked" class="text-sm text-text-secondary">{{ formatRemainingSeconds(props.remainingSeconds) }}</span>
    </div>
    <p v-if="props.blocked" class="mb-5 text-sm text-error">Your internet access has been blocked. Please contact an administrator for more information.</p>
    <div v-else-if="props.expiresAt && props.remainingSeconds > 0" class="mb-5">
      <CountdownTimer :expires-at="props.expiresAt" @expired="emit('expired')" />
    </div>
    <p v-if="props.expiresAt && !props.blocked && props.remainingSeconds > 0" class="mb-5 text-sm text-text-secondary">
      Your internet switches off at <span class="font-medium text-text-primary">{{ formatDateTime(props.expiresAt) }}</span>
    </p>
    <button v-if="props.showAction && !props.blocked" type="button" class="btn-primary" @click="emit('renew')">
      {{ actionLabel }}
    </button>
  </div>
</template>

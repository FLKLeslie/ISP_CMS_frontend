<script setup lang="ts">
import type { Subscription } from '~/types/api/subscriptions'

// Opens a BLOCKED subscription back up. The administrator picks one of two
// outcomes, each shown with its real numbers so nothing is a surprise:
//
//   Allow as it is        reconnect; the plan still ends on its current date
//   Add the blocked time  reconnect AND push the end date out by the days the
//                         customer spent blocked
//
// The parent controls visibility via `subscription` (null = closed) and gets
// the updated subscription back on `resumed`. If the plan had already run out
// while blocked the server marks it Expired instead of reconnecting; the
// parent decides how to tell the admin (it can see the returned status).
const props = defineProps<{ subscription: Subscription | null }>()
const emit = defineEmits<{ close: []; resumed: [subscription: Subscription] }>()

const { resumeSubscription } = useSubscriptionsApi()

const addBlockedTime = ref(false)
const submitting = ref(false)
const error = ref('')

// Start from the safe default (change nothing) each time it opens.
watch(() => props.subscription?.id, () => {
  addBlockedTime.value = false
  error.value = ''
}, { immediate: true })

// Exact blocked time, to the minute - "add the blocked time" gives back exactly
// this, which matters when a plan lasts hours or minutes rather than days.
const blockedSeconds = computed(() => props.subscription?.blocked_seconds ?? 0)
const blockedLabel = computed(() => formatDuration(blockedSeconds.value, 3))
const newEnd = computed(() => {
  if (!props.subscription) return ''
  return new Date(new Date(props.subscription.ends_at).getTime() + blockedSeconds.value * 1000).toISOString()
})

async function submit() {
  if (!props.subscription) return
  submitting.value = true
  error.value = ''
  try {
    const updated = await resumeSubscription(props.subscription.id, addBlockedTime.value)
    emit('resumed', updated)
    emit('close')
  } catch (err) {
    error.value = apiErrorMessage(err, "Couldn't resume this subscription. Please try again.")
  } finally {
    submitting.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.subscription && !submitting.value) emit('close')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const optionBase = 'flex w-full items-start gap-3 rounded-card border p-3 text-left transition-colors disabled:opacity-50'
</script>

<template>
  <div
    v-if="subscription"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:px-4"
    @mousedown.self="!submitting && emit('close')"
  >
    <div
      class="flex max-h-[92vh] w-full flex-col rounded-t-card border border-border bg-surface shadow-xl sm:max-w-md sm:rounded-card"
      role="dialog" aria-modal="true" aria-labelledby="resume-title"
    >
      <div class="border-b border-border p-5">
        <h2 id="resume-title" class="text-base font-semibold text-text-primary">Resume this subscription</h2>
        <p class="mt-1 text-sm text-text-secondary">
          {{ subscription.plan.name }} · blocked for
          <span class="font-medium text-text-primary">{{ blockedLabel }}</span>.
          Their internet is reconnected either way — choose what happens to their time.
        </p>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto p-5">
        <button
          type="button" :disabled="submitting" role="radio" :aria-checked="!addBlockedTime"
          :class="[optionBase, !addBlockedTime ? 'border-secondary bg-secondary/10' : 'border-border hover:bg-text-secondary/10']"
          @click="addBlockedTime = false"
        >
          <span class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border" :class="!addBlockedTime ? 'border-secondary' : 'border-border'" aria-hidden="true">
            <span v-if="!addBlockedTime" class="h-2 w-2 rounded-full bg-secondary" />
          </span>
          <span>
            <span class="block text-sm font-medium text-text-primary">Allow it as it is</span>
            <span class="block text-xs text-text-secondary">
              The plan still ends at {{ formatDateTime(subscription.ends_at) }}. The time it was blocked isn't given back.
            </span>
          </span>
        </button>

        <button
          type="button" :disabled="submitting" role="radio" :aria-checked="addBlockedTime"
          :class="[optionBase, addBlockedTime ? 'border-secondary bg-secondary/10' : 'border-border hover:bg-text-secondary/10']"
          @click="addBlockedTime = true"
        >
          <span class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border" :class="addBlockedTime ? 'border-secondary' : 'border-border'" aria-hidden="true">
            <span v-if="addBlockedTime" class="h-2 w-2 rounded-full bg-secondary" />
          </span>
          <span>
            <span class="block text-sm font-medium text-text-primary">Add the blocked time</span>
            <span class="block text-xs text-text-secondary">
              <template v-if="blockedSeconds > 0">
                Adds {{ blockedLabel }}, so the plan now ends at {{ formatDateTime(newEnd) }} instead of {{ formatDateTime(subscription.ends_at) }}.
              </template>
              <template v-else>Blocked for less than a minute, so there's nothing to add — same as allowing it as it is.</template>
            </span>
          </span>
        </button>

        <p v-if="error" role="alert" class="rounded-card border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{{ error }}</p>
      </div>

      <div class="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
        <button type="button" :disabled="submitting" class="btn-secondary" @click="emit('close')">Cancel</button>
        <button type="button" :disabled="submitting" class="btn-primary" @click="submit">
          {{ submitting ? 'Please wait…' : 'Resume subscription' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Live days/hours/minutes countdown to an ISO timestamp (Subscription.
// expires_at). Ticks every minute on a client-only timer - re-rendering
// every second for a minutes-scale countdown would be wasted work.
const props = defineProps<{ expiresAt: string }>()
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 60_000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

const remaining = computed(() => {
  const diffMs = new Date(props.expiresAt).getTime() - now.value
  if (diffMs <= 0) return null
  const totalMinutes = Math.floor(diffMs / 60_000)
  return { days: Math.floor(totalMinutes / 1440), hours: Math.floor((totalMinutes % 1440) / 60), minutes: totalMinutes % 60 }
})
</script>
<template>
  <div v-if="remaining" class="flex items-center gap-3" role="timer" :aria-label="`${remaining.days} days ${remaining.hours} hours ${remaining.minutes} minutes remaining`">
    <div v-for="unit in [{ value: remaining.days, label: 'Days' }, { value: remaining.hours, label: 'Hrs' }, { value: remaining.minutes, label: 'Min' }]" :key="unit.label" class="flex flex-col items-center">
      <span class="min-w-[2.5rem] rounded-card bg-secondary/10 px-2.5 py-1.5 text-center text-lg font-semibold tabular-nums text-secondary">{{ String(unit.value).padStart(2, '0') }}</span>
      <span class="mt-1 text-[0.65rem] font-medium uppercase tracking-wide text-text-secondary">{{ unit.label }}</span>
    </div>
  </div>
  <p v-else class="text-sm font-medium text-error">Expired</p>
</template>

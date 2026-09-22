<script setup lang="ts">
// Live countdown to an exact ISO moment (Subscription.ends_at). Plans can last
// just minutes, so it ticks every second and, under a day, shows seconds too
// (Hrs / Min / Sec); a longer plan shows Days / Hrs / Min. When the moment
// arrives it says so once (`expired`) so the page can re-fetch the real state
// instead of sitting on a stale "0 seconds".
const props = defineProps<{ expiresAt: string }>()
const emit = defineEmits<{ expired: [] }>()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

const totalSeconds = computed(() => Math.floor((new Date(props.expiresAt).getTime() - now.value) / 1000))
const remaining = computed(() => {
  const t = totalSeconds.value
  if (t <= 0) return null
  return { days: Math.floor(t / 86400), hours: Math.floor((t % 86400) / 3600), minutes: Math.floor((t % 3600) / 60), seconds: t % 60 }
})
const units = computed(() => {
  const r = remaining.value
  if (!r) return []
  return r.days > 0
    ? [{ value: r.days, label: 'Days' }, { value: r.hours, label: 'Hrs' }, { value: r.minutes, label: 'Min' }]
    : [{ value: r.hours, label: 'Hrs' }, { value: r.minutes, label: 'Min' }, { value: r.seconds, label: 'Sec' }]
})

// Fire once, and only for a countdown that was actually running (not one that
// was already past when the page loaded).
let wasRunning = false
watch(totalSeconds, (t) => {
  if (t > 0) wasRunning = true
  else if (wasRunning) { wasRunning = false; emit('expired') }
}, { immediate: true })
</script>
<template>
  <div v-if="remaining" class="flex items-center gap-3" role="timer" :aria-label="`${formatDuration(totalSeconds, 3)} remaining`">
    <div v-for="unit in units" :key="unit.label" class="flex flex-col items-center">
      <span class="min-w-[2.5rem] rounded-card bg-secondary/10 px-2.5 py-1.5 text-center text-lg font-semibold tabular-nums text-secondary">{{ String(unit.value).padStart(2, '0') }}</span>
      <span class="mt-1 text-[0.65rem] font-medium uppercase tracking-wide text-text-secondary">{{ unit.label }}</span>
    </div>
  </div>
  <p v-else class="text-sm font-medium text-error">Expired</p>
</template>

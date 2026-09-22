<script setup lang="ts">
// How long a plan lasts, typed the natural way - a number and a unit - while the
// model value is always MINUTES (what the API stores), so "2 hours" and "120
// minutes" are the same plan.
const props = defineProps<{ modelValue: number; id?: string }>()
const emit = defineEmits<{ 'update:modelValue': [minutes: number] }>()

const FACTOR = { minutes: 1, hours: 60, days: 1440 } as const
type Unit = keyof typeof FACTOR

// Show an existing length in the largest unit that expresses it exactly
// (43200 -> 30 days, 90 -> 90 minutes), so editing a plan looks like it was created.
function split(minutes: number): { amount: number; unit: Unit } {
  if (minutes > 0 && minutes % 1440 === 0) return { amount: minutes / 1440, unit: 'days' }
  if (minutes > 0 && minutes % 60 === 0) return { amount: minutes / 60, unit: 'hours' }
  return { amount: minutes, unit: 'minutes' }
}

const initial = split(props.modelValue)
const amount = ref<number>(initial.amount)
const unit = ref<Unit>(initial.unit)

const minutes = computed(() => Math.round((Number(amount.value) || 0) * FACTOR[unit.value]))
watch(minutes, (value) => { if (value !== props.modelValue) emit('update:modelValue', value) })

// If the parent loads a different plan, follow it - but never fight the user
// while they're typing (only re-split when it genuinely differs from what's shown).
watch(() => props.modelValue, (value) => {
  if (value !== minutes.value) {
    const next = split(value)
    amount.value = next.amount
    unit.value = next.unit
  }
})

const field = 'rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent'
</script>

<template>
  <div class="flex gap-2">
    <input :id="id" v-model.number="amount" type="number" min="1" step="1" required :class="field" class="min-w-0 flex-1" aria-label="Duration">
    <select v-model="unit" :class="field" aria-label="Duration unit">
      <option value="minutes">Minutes</option>
      <option value="hours">Hours</option>
      <option value="days">Days</option>
    </select>
  </div>
</template>

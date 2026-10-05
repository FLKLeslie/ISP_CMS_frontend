<script setup lang="ts">
// One speed, typed the natural way - a number and a unit - while the model value is
// always WHOLE KILOBITS PER SECOND (what the API stores), so "5 Mbps" and "5000 kbps"
// are the same value. null = nothing entered (read as the default by whoever uses it).
// Same idea as DurationInput.
const props = defineProps<{ modelValue: number | null; id?: string; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [kbps: number | null] }>()

const initial = splitSpeed(props.modelValue)
const amount = ref<number | string>(initial.amount)
const unit = ref<SpeedUnit>(initial.unit)

const kbps = computed(() => toKbps(amount.value, unit.value))
watch(kbps, (value) => { if (value !== props.modelValue) emit('update:modelValue', value) })

// If the parent changes the value (e.g. loads another plan or device), follow it -
// but never fight the user while they're typing: only re-split when it truly differs.
watch(() => props.modelValue, (value) => {
  if (value !== kbps.value) {
    const next = splitSpeed(value)
    amount.value = next.amount
    unit.value = next.unit
  }
})

const field = 'rounded-card border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent'
</script>

<template>
  <div class="flex gap-2">
    <input
      :id="id" v-model="amount" type="number" min="0" step="any" inputmode="decimal" :class="field"
      class="min-w-0 flex-1" :aria-label="label ?? 'Speed'" placeholder="e.g. 5"
    >
    <select v-model="unit" :class="field" :aria-label="`${label ?? 'Speed'} unit`">
      <option v-for="u in (['kbps', 'Mbps', 'Gbps'] as const)" :key="u" :value="u">{{ u }}</option>
    </select>
  </div>
</template>

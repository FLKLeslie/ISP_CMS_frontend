<script setup lang="ts">
// The speed a plan gives: either DEFAULT (the MikroTik is told nothing about speed)
// or an uplink + downlink limit that is applied to a customer's router whenever the
// plan is activated. Both-or-neither is enforced by the backend; this keeps the form
// honest too. Used by the "New plan" form and the plan details modal.
//
// uplink/downlink are whole kbps; both null = default.
const props = defineProps<{ uplink: number | null; downlink: number | null }>()
const emit = defineEmits<{
  'update:uplink': [kbps: number | null]
  'update:downlink': [kbps: number | null]
  // false while "custom" is chosen but a speed is still missing - lets the parent block saving.
  'update:valid': [valid: boolean]
}>()

// "Custom, but nothing typed yet" can't be told apart from "default" by the two
// values alone (both null), so the choice is held here.
const mode = ref<'default' | 'custom'>(props.uplink != null && props.downlink != null ? 'custom' : 'default')

// A different plan was loaded: follow it.
watch(() => [props.uplink, props.downlink], ([up, down]) => {
  if (up != null && down != null) mode.value = 'custom'
  else if (up == null && down == null && mode.value === 'custom' && !touched.value) mode.value = 'default'
})
const touched = ref(false)

function choose(next: 'default' | 'custom') {
  touched.value = true
  mode.value = next
  if (next === 'default') {
    emit('update:uplink', null)
    emit('update:downlink', null)
  }
}

const valid = computed(() => mode.value === 'default' || (props.uplink != null && props.downlink != null))
watch(valid, (value) => emit('update:valid', value), { immediate: true })

const radio = 'mt-0.5 h-4 w-4 accent-accent'
</script>

<template>
  <fieldset class="space-y-3">
    <legend class="mb-1 block text-sm font-medium text-text-primary">Speed</legend>

    <label class="flex cursor-pointer items-start gap-3 rounded-card border border-border bg-background p-3" :class="{ 'border-accent': mode === 'default' }">
      <input type="radio" :class="radio" :checked="mode === 'default'" @change="choose('default')">
      <span>
        <span class="block text-sm font-medium text-text-primary">Default speed</span>
        <span class="block text-xs text-text-secondary">
          The MikroTik is told nothing about speed. If a customer's router already has a limit, activating this plan lifts it.
        </span>
      </span>
    </label>

    <label class="flex cursor-pointer items-start gap-3 rounded-card border border-border bg-background p-3" :class="{ 'border-accent': mode === 'custom' }">
      <input type="radio" :class="radio" :checked="mode === 'custom'" @change="choose('custom')">
      <span>
        <span class="block text-sm font-medium text-text-primary">Set uplink and downlink limits</span>
        <span class="block text-xs text-text-secondary">
          Whenever this plan is activated for a customer, their router is capped at these speeds.
        </span>
      </span>
    </label>

    <div v-if="mode === 'custom'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label class="mb-1 block text-xs font-medium text-text-secondary">Uplink <span class="font-normal">(upload - data leaving the customer)</span></label>
        <SpeedInput :model-value="props.uplink" label="Uplink" @update:model-value="emit('update:uplink', $event)" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-text-secondary">Downlink <span class="font-normal">(download - data coming to the customer)</span></label>
        <SpeedInput :model-value="props.downlink" label="Downlink" @update:model-value="emit('update:downlink', $event)" />
      </div>
      <p v-if="!valid" role="alert" class="text-xs text-error sm:col-span-2">Enter both speeds, or choose Default speed.</p>
    </div>
  </fieldset>
</template>

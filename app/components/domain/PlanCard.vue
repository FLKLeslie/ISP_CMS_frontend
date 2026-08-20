<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import type { Plan } from '~/types/api/subscriptions'
const props = defineProps<{ plan: Plan; current?: boolean; adminMode?: boolean }>()
const emit = defineEmits<{ select: [plan: Plan] }>()
</script>
<template>
  <div class="flex flex-col rounded-card border p-5" :class="props.current ? 'border-secondary bg-secondary/5' : 'border-border bg-surface'">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-base font-semibold text-text-primary">{{ props.plan.name }}</h3>
      <StatusBadge v-if="props.current" label="Current Plan" tone="success" />
      <StatusBadge v-else-if="props.adminMode" :label="props.plan.is_active ? 'Active' : 'Inactive'" :tone="props.plan.is_active ? 'success' : 'neutral'" />
    </div>
    <p class="mb-4 text-2xl font-semibold text-text-primary">
      {{ formatCurrency(props.plan.price) }}<span class="text-sm font-normal text-text-secondary"> / {{ props.plan.duration_days }} days</span>
    </p>
    <p v-if="props.plan.description" class="mb-4 flex-1 text-sm text-text-secondary">{{ props.plan.description }}</p>
    <div class="mb-4 flex items-center gap-2 text-sm text-text-secondary">
      <Check class="h-4 w-4 text-success" aria-hidden="true" />{{ props.plan.duration_days }}-day subscription period
    </div>
    <button v-if="!props.adminMode" type="button" :disabled="props.current"
      class="rounded-card px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      :class="props.current ? 'bg-text-secondary/10 text-text-secondary' : 'bg-secondary text-white hover:opacity-90'"
      @click="emit('select', props.plan)">
      {{ props.current ? 'Current Plan' : 'Select Plan' }}
    </button>
  </div>
</template>

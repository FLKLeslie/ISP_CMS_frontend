<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import type { Plan } from '~/types/api/subscriptions'
const props = defineProps<{ plan: Plan; current?: boolean; adminMode?: boolean }>()
const emit = defineEmits<{ select: [plan: Plan]; details: [plan: Plan] }>()
</script>
<template>
  <div class="flex flex-col rounded-card border p-5" :class="props.current ? 'border-secondary bg-secondary/5' : 'border-border bg-surface'">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-base font-semibold text-text-primary">{{ props.plan.name }}</h3>
      <StatusBadge v-if="props.current" label="Current Plan" tone="success" />
      <StatusBadge v-else-if="props.adminMode" :label="props.plan.is_active ? 'Active' : 'Inactive'" :tone="props.plan.is_active ? 'success' : 'neutral'" />
    </div>
    <p class="mb-4 text-2xl font-semibold text-text-primary">
      {{ formatCurrency(props.plan.price) }}<span class="text-sm font-normal text-text-secondary"> / {{ props.plan.duration_label }}</span>
    </p>
    <p v-if="props.plan.description" class="mb-4 flex-1 text-sm text-text-secondary">{{ props.plan.description }}</p>
    <div class="mb-4 flex items-center gap-2 text-sm text-text-secondary">
      <Check class="h-4 w-4 text-success" aria-hidden="true" />Lasts {{ props.plan.duration_label }}
    </div>
    <button v-if="!props.adminMode" type="button" class="btn-primary" @click="emit('select', props.plan)">
      {{ props.current ? 'Duplicate this plan' : 'Select Plan' }}
    </button>
    <p v-if="props.current" class="mt-2 text-xs text-text-secondary">Buying it again adds another {{ props.plan.duration_label }} after your current period ends.</p>
    <button v-if="props.adminMode" type="button" class="btn-secondary" @click="emit('details', props.plan)">Details</button>
  </div>
</template>

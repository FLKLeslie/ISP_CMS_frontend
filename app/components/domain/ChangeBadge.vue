<script setup lang="ts">
import { Minus, TrendingDown, TrendingUp } from 'lucide-vue-next'

// A growth figure that reads at a glance: green up-arrow for growth, red
// down-arrow for decline, neutral for flat. `pct` is null when there is nothing
// earlier to compare against — going from zero isn't a percentage, so that is
// shown as a plain note rather than a misleading "+∞%".
const props = defineProps<{ pct: number | null; emptyLabel?: string }>()

const view = computed(() => {
  if (props.pct === null) return null
  if (props.pct > 0.05) return { tone: 'text-success bg-success/10', icon: TrendingUp, text: `+${props.pct}%` }
  if (props.pct < -0.05) return { tone: 'text-error bg-error/10', icon: TrendingDown, text: `${props.pct}%` }
  return { tone: 'text-text-secondary bg-text-secondary/10', icon: Minus, text: '0%' }
})
</script>

<template>
  <span v-if="view" class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" :class="view.tone">
    <component :is="view.icon" class="h-3 w-3" aria-hidden="true" />{{ view.text }}
  </span>
  <span v-else class="text-xs text-text-secondary">{{ emptyLabel ?? 'No earlier data' }}</span>
</template>

<script setup lang="ts">
type StatusTone = 'success' | 'warning' | 'error' | 'neutral' | 'info'
const props = defineProps<{ label: string; tone: StatusTone }>()
const toneClasses: Record<StatusTone, string> = {
  success: 'bg-success/10 text-success', warning: 'bg-warning/10 text-warning', error: 'bg-error/10 text-error',
  info: 'bg-accent/10 text-accent', neutral: 'bg-text-secondary/10 text-text-secondary',
}
</script>
<template>
  <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" :class="toneClasses[props.tone]">
    <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{{ props.label }}
  </span>
</template>

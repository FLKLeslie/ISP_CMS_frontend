<script setup lang="ts">
/**
 * Every status indicator in the app should go through this component -
 * it's the single place enforcing "never communicate status with color
 * alone" (design spec §18). Icon + text + color, always together.
 */
type StatusTone = 'success' | 'warning' | 'error' | 'neutral' | 'info'

const props = withDefaults(
  defineProps<{
    label: string
    tone: StatusTone
  }>(),
  {},
)

const toneClasses: Record<StatusTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  info: 'bg-accent/10 text-accent',
  neutral: 'bg-text-secondary/10 text-text-secondary',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
    :class="toneClasses[props.tone]"
  >
    <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
    {{ props.label }}
  </span>
</template>

<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    message?: string
    retryable?: boolean
  }>(),
  {
    // Plain language per the design spec (§2) - never a raw DRF error shape.
    message: "Something didn't load correctly. Please try again.",
    retryable: true,
  },
)

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center gap-3 rounded-card border border-error/20 bg-error/5 px-6 py-10 text-center">
    <AlertTriangle class="h-6 w-6 text-error" aria-hidden="true" />
    <p class="text-sm text-text-primary">{{ props.message }}</p>
    <button
      v-if="props.retryable"
      type="button"
      class="rounded-card border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-text-secondary/10"
      @click="emit('retry')"
    >
      Try again
    </button>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ open: boolean; title: string; description?: string; confirmLabel?: string; danger?: boolean }>(), { confirmLabel: 'Confirm', danger: false })
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>
<template>
  <div v-if="props.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div class="w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-lg" role="alertdialog" aria-modal="true">
      <h2 class="text-base font-semibold text-text-primary">{{ props.title }}</h2>
      <p v-if="props.description" class="mt-1.5 text-sm text-text-secondary">{{ props.description }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" class="rounded-card border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-text-secondary/10" @click="emit('cancel')">Cancel</button>
        <button type="button" class="rounded-card px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90" :class="props.danger ? 'bg-error' : 'bg-secondary'" @click="emit('confirm')">{{ props.confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>

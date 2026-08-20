<script setup lang="ts">
const props = withDefaults(defineProps<{ label?: string; rows?: number }>(), { label: 'Loading…', rows: 3 })
</script>
<template>
  <div class="space-y-3" role="status" :aria-label="props.label">
    <div v-for="row in props.rows" :key="row" class="h-16 animate-pulse rounded-card bg-text-secondary/10" />
    <span class="sr-only">{{ props.label }}</span>
  </div>
</template>

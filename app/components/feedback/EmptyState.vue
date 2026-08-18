<script setup lang="ts">
import type { Component } from 'vue'

const props = defineProps<{
  icon?: Component
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center gap-2 rounded-card border border-dashed border-border px-6 py-10 text-center">
    <component :is="props.icon" v-if="props.icon" class="h-6 w-6 text-text-secondary" aria-hidden="true" />
    <p class="text-sm font-medium text-text-primary">{{ props.title }}</p>
    <p v-if="props.description" class="text-sm text-text-secondary">{{ props.description }}</p>
    <div v-if="$slots.action" class="mt-2">
      <slot name="action" />
    </div>
  </div>
</template>

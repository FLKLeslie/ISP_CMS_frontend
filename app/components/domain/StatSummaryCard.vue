<script setup lang="ts">
import type { Component } from 'vue'
const props = defineProps<{
  label: string
  value: string | number
  icon: Component
  tone?: 'primary' | 'success' | 'warning' | 'error' | 'accent'
  // Optional — when set, the whole card becomes a link (e.g. "Total
  // Customers" -> /admin/customers, "Suspended Customers" ->
  // /admin/customers?status=SUSPENDED). Omit for a plain, non-clickable
  // stat card.
  to?: string
}>()
const toneClasses: Record<string, string> = {
  primary: 'bg-primary/10 text-primary', success: 'bg-success/10 text-success', warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error', accent: 'bg-accent/10 text-accent',
}
</script>
<template>
  <NuxtLink
    v-if="props.to"
    :to="props.to"
    class="block rounded-card border border-border bg-surface p-4 transition-colors hover:border-accent/50 hover:bg-text-secondary/5"
  >
    <div class="mb-3 flex h-9 w-9 items-center justify-center rounded-full" :class="toneClasses[props.tone ?? 'primary']">
      <component :is="props.icon" class="h-[18px] w-[18px]" aria-hidden="true" />
    </div>
    <p class="text-xs text-text-secondary">{{ props.label }}</p>
    <p class="mt-0.5 text-xl font-semibold text-text-primary">{{ props.value }}</p>
  </NuxtLink>
  <div v-else class="rounded-card border border-border bg-surface p-4">
    <div class="mb-3 flex h-9 w-9 items-center justify-center rounded-full" :class="toneClasses[props.tone ?? 'primary']">
      <component :is="props.icon" class="h-[18px] w-[18px]" aria-hidden="true" />
    </div>
    <p class="text-xs text-text-secondary">{{ props.label }}</p>
    <p class="mt-0.5 text-xl font-semibold text-text-primary">{{ props.value }}</p>
  </div>
</template>
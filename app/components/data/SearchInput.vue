<script setup lang="ts">
import { Search } from 'lucide-vue-next'
const props = withDefaults(defineProps<{ modelValue: string; placeholder?: string }>(), { placeholder: 'Search…' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template>
  <div class="relative">
    <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
    <input :value="props.modelValue" type="search" :placeholder="props.placeholder" class="w-full rounded-card border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary outline-none focus:border-accent" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
  </div>
</template>

<script setup lang="ts">
import { Monitor, Moon, Sun } from 'lucide-vue-next'
const { choice, setTheme } = useTheme()
const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]
</script>
<template>
  <div class="inline-flex items-center gap-0.5 rounded-card border border-border bg-surface p-0.5" role="radiogroup" aria-label="Theme">
    <button v-for="option in options" :key="option.value" type="button" role="radio" :aria-checked="choice === option.value"
      class="flex items-center gap-1.5 rounded-[0.4rem] px-2.5 py-1.5 text-sm font-medium transition-colors"
      :class="choice === option.value ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'"
      @click="setTheme(option.value)">
      <component :is="option.icon" class="h-4 w-4" aria-hidden="true" />
      <span class="hidden sm:inline">{{ option.label }}</span>
    </button>
  </div>
</template>

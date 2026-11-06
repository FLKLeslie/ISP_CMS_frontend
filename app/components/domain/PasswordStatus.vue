<script setup lang="ts">
withDefaults(defineProps<{ mustChange?: boolean }>(), { mustChange: false })
</script>
<template>
  <div class="text-sm">
    <span class="text-text-secondary" aria-label="Password is hidden">••••••••</span>
    <span class="ml-2 text-xs text-text-secondary">{{ mustChange ? 'Reset required' : 'Set' }}</span>
  </div>
</template>

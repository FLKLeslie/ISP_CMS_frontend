<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
const props = defineProps<{ currentPage: number; totalPages: number }>()
const emit = defineEmits<{ change: [page: number] }>()
</script>
<template>
  <nav v-if="props.totalPages > 1" class="flex items-center justify-between" aria-label="Pagination">
    <button type="button" :disabled="props.currentPage <= 1" class="flex items-center gap-1 rounded-card border border-border px-3 py-1.5 text-sm text-text-primary hover:bg-text-secondary/10 disabled:cursor-not-allowed disabled:opacity-40" @click="emit('change', props.currentPage - 1)">
      <ChevronLeft class="h-4 w-4" aria-hidden="true" /> Previous
    </button>
    <span class="text-sm text-text-secondary">Page {{ props.currentPage }} of {{ props.totalPages }}</span>
    <button type="button" :disabled="props.currentPage >= props.totalPages" class="flex items-center gap-1 rounded-card border border-border px-3 py-1.5 text-sm text-text-primary hover:bg-text-secondary/10 disabled:cursor-not-allowed disabled:opacity-40" @click="emit('change', props.currentPage + 1)">
      Next <ChevronRight class="h-4 w-4" aria-hidden="true" />
    </button>
  </nav>
</template>

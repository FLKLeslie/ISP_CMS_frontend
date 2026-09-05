<script setup lang="ts">
import type { NavItem } from '~/types/nav'
const props = defineProps<{ items: NavItem[]; brandLabel: string; open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>
<template>
  <div v-if="props.open" class="fixed inset-0 z-30 bg-black/40 md:hidden" aria-hidden="true" @click="emit('close')" />
  <aside class="fixed inset-y-0 left-0 z-40 flex w-56 flex-col bg-primary text-white shadow-lg transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0"
    :class="props.open ? 'translate-x-0' : '-translate-x-full'">
    <div class="flex h-14 items-center gap-2 border-b border-white/10 px-4 text-base font-semibold tracking-tight">{{ props.brandLabel }}</div>
    <nav class="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2" aria-label="Primary">
      <NuxtLink v-for="item in props.items" :key="item.to" :to="item.to"
        class="flex items-center gap-2.5 rounded-card px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        active-class="bg-white/15 text-white" @click="emit('close')">
        <component :is="item.icon" class="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
        <span class="flex-1">{{ item.label }}</span>
        <span
          v-if="item.badge"
          class="rounded-full bg-warning px-2 py-0.5 text-xs font-semibold text-white"
        >{{ item.badge }}</span>
      </NuxtLink>
    </nav>
  </aside>
</template>
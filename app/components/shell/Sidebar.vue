<script setup lang="ts">
import type { NavItem } from '~/types/nav'
// `sectionLabel` is the small tag under the application name, e.g. "Admin" - the name
// and logo themselves come from branding.config.ts (see useBrand / BrandLogo).
import { Star } from 'lucide-vue-next'
const props = defineProps<{ items: NavItem[]; sectionLabel?: string; isMainSuperadmin?: boolean; open: boolean }>()
const brand = useBrand()
const route = useRoute()
const emit = defineEmits<{ close: [] }>()
</script>
<template>
  <div v-if="props.open" class="fixed inset-0 z-30 bg-black/40 md:hidden" aria-hidden="true" @click="emit('close')" />
  <aside class="fixed inset-y-0 left-0 z-40 flex w-56 flex-col bg-primary text-white shadow-lg transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0"
    :class="props.open ? 'translate-x-0' : '-translate-x-full'">
    <div class="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
      <BrandLogo size="sm" tile />
      <div class="min-w-0 leading-tight">
        <span class="block truncate text-base font-semibold tracking-tight">{{ brand.name }}</span>
        <span v-if="props.sectionLabel" class="flex items-center gap-1 truncate text-[11px] font-medium uppercase tracking-wider text-white/90">{{ props.sectionLabel }}<Star v-if="props.isMainSuperadmin" class="h-3 w-3 fill-amber-300 text-amber-300" aria-label="Main administrator" /></span>
      </div>
    </div>
    <nav class="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2" aria-label="Primary">
      <NuxtLink v-for="item in props.items" :key="item.to" :to="item.to"
        class="flex items-center gap-2.5 rounded-card px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
        active-class="bg-white/15 text-white" :class="item.activePaths?.includes(route.path) ? 'bg-white/15 text-white' : ''" @click="emit('close')">
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
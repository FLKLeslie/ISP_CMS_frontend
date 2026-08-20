<script setup lang="ts">
import { ChevronDown, LogOut, Menu } from 'lucide-vue-next'
const props = defineProps<{ userName: string; unreadNotifications: number; notificationsTo: string }>()
const emit = defineEmits<{ 'toggle-sidebar': []; logout: [] }>()
const menuOpen = ref(false)
</script>
<template>
  <header class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
    <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-card text-text-secondary hover:bg-text-secondary/10 md:hidden" aria-label="Open menu" @click="emit('toggle-sidebar')">
      <Menu class="h-5 w-5" aria-hidden="true" />
    </button>
    <div class="flex-1" />
    <div class="flex items-center gap-2">
      <ThemeSwitcher class="hidden sm:inline-flex" />
      <NotificationBell :unread-count="props.unreadNotifications" :to="props.notificationsTo" />
      <div class="relative">
        <button type="button" class="flex items-center gap-2 rounded-card px-2 py-1.5 text-sm font-medium text-text-primary hover:bg-text-secondary/10" :aria-expanded="menuOpen" aria-haspopup="true" @click="menuOpen = !menuOpen">
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-white" aria-hidden="true">{{ props.userName.charAt(0).toUpperCase() }}</span>
          <span class="hidden sm:inline">{{ props.userName }}</span>
          <ChevronDown class="h-4 w-4 text-text-secondary" aria-hidden="true" />
        </button>
        <div v-if="menuOpen" class="absolute right-0 mt-2 w-40 rounded-card border border-border bg-surface py-1 shadow-lg" @click="menuOpen = false">
          <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-text-secondary/10" @click="emit('logout')">
            <LogOut class="h-4 w-4" aria-hidden="true" /> Log out
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ChevronDown, LogOut, Menu, ShieldCheck, Star } from 'lucide-vue-next'
import type { NavItem } from '~/types/nav'
const props = defineProps<{ userName: string; isMainSuperadmin?: boolean; unreadNotifications: number; notificationsTo: string; adminMenuItems?: NavItem[] }>()
const emit = defineEmits<{ 'toggle-sidebar': []; logout: [] }>()
const menuOpen = ref(false)
const adminMenuOpen = ref(false)
const adminMenuRef = ref<HTMLElement | null>(null)

function closeAdminMenuOnOutside(event: MouseEvent) {
  if (!adminMenuOpen.value) return
  const target = event.target as Node | null
  if (target && adminMenuRef.value && !adminMenuRef.value.contains(target)) {
    adminMenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', closeAdminMenuOnOutside))
onBeforeUnmount(() => document.removeEventListener('click', closeAdminMenuOnOutside))
</script>
<template>
  <header class="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
    <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-card text-text-secondary hover:bg-text-secondary/10 md:hidden" aria-label="Open menu" @click="emit('toggle-sidebar')">
      <Menu class="h-5 w-5" aria-hidden="true" />
    </button>
    <div class="flex-1" />
    <div class="flex items-center gap-2">
      <ThemeSwitcher class="inline-flex shrink-0" />
      <div v-if="props.adminMenuItems?.length" ref="adminMenuRef" class="relative">
        <button type="button" class="inline-flex items-center gap-2 rounded-card border border-border px-2 py-2 text-sm font-medium text-text-primary hover:bg-text-secondary/10 sm:px-3" :aria-expanded="adminMenuOpen" aria-haspopup="true" @click="adminMenuOpen = !adminMenuOpen">
          <ShieldCheck class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">Admin Menu</span>
          <ChevronDown class="h-4 w-4" aria-hidden="true" />
        </button>
        <Transition name="menu-soft">
        <div v-if="adminMenuOpen" class="absolute right-0 mt-2 w-56 rounded-card border border-border bg-surface py-1 shadow-lg" @click="adminMenuOpen = false">
          <NuxtLink v-for="item in props.adminMenuItems" :key="item.to" :to="item.to" class="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-text-secondary/10">
            <component :is="item.icon" class="h-4 w-4" aria-hidden="true" />{{ item.label }}
          </NuxtLink>
        </div>
        </Transition>
      </div>
      <NotificationBell :unread-count="props.unreadNotifications" :to="props.notificationsTo" />
      <div class="relative">
        <button type="button" class="flex items-center gap-2 rounded-card px-2 py-1.5 text-sm font-medium text-text-primary hover:bg-text-secondary/10" :aria-expanded="menuOpen" aria-haspopup="true" @click="menuOpen = !menuOpen">
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-white" aria-hidden="true">{{ props.userName.charAt(0).toUpperCase() }}</span>
          <span class="hidden sm:inline">{{ props.userName }}</span>
          <Star v-if="props.isMainSuperadmin" class="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Main administrator" />
          <ChevronDown class="h-4 w-4 text-text-secondary" aria-hidden="true" />
        </button>
        <Transition name="menu-soft">
        <div v-if="menuOpen" class="absolute right-0 mt-2 w-40 rounded-card border border-border bg-surface py-1 shadow-lg" @click="menuOpen = false">
          <button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-text-secondary/10" @click="emit('logout')">
            <LogOut class="h-4 w-4" aria-hidden="true" /> Log out
          </button>
        </div>
        </Transition>
      </div>
    </div>
  </header>
</template>

<style scoped>
.menu-soft-enter-active, .menu-soft-leave-active { transition: opacity 140ms ease, transform 140ms ease; transform-origin: top right; }
.menu-soft-enter-from, .menu-soft-leave-to { opacity: 0; transform: translateY(-4px) scale(.98); }
@media (prefers-reduced-motion: reduce) { .menu-soft-enter-active, .menu-soft-leave-active { transition: none; } }
</style>

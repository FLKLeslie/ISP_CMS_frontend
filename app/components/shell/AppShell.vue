<script setup lang="ts">
import type { NavItem } from '~/types/nav'
const props = defineProps<{ navItems: NavItem[]; adminMenuItems?: NavItem[]; sectionLabel?: string; isMainSuperadmin?: boolean; userName: string; unreadNotifications: number; notificationsTo: string }>()
const emit = defineEmits<{ logout: [] }>()
const sidebarOpen = ref(false)
</script>
<template>
  <div class="flex min-h-screen bg-background">
    <Sidebar :items="props.navItems" :section-label="props.sectionLabel" :is-main-superadmin="props.isMainSuperadmin" :open="sidebarOpen" @close="sidebarOpen = false" />
    <div class="flex min-w-0 flex-1 flex-col">
      <Topbar :user-name="props.userName" :is-main-superadmin="props.isMainSuperadmin" :admin-menu-items="props.adminMenuItems" :unread-notifications="props.unreadNotifications" :notifications-to="props.notificationsTo" @toggle-sidebar="sidebarOpen = !sidebarOpen" @logout="emit('logout')" />
      <main class="flex-1 px-4 py-5 sm:px-6 lg:px-8 2xl:px-10"><slot /></main>
      <footer class="border-t border-border bg-surface/80 px-4 py-2 text-center text-[11px] text-text-secondary">
        <span>AirFiber by INVISEC</span>
        <span class="mx-2 text-text-secondary/70">•</span>
        <span>Secure system access</span>
      </footer>
    </div>
  </div>
</template>

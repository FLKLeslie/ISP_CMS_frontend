<script setup lang="ts">
import type { NavItem } from '~/types/nav'

const props = defineProps<{
  navItems: NavItem[]
  brandLabel: string
  userName: string
  unreadNotifications: number
  notificationsTo: string
}>()

const emit = defineEmits<{ logout: [] }>()

const sidebarOpen = ref(false)
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <Sidebar
      :items="props.navItems"
      :brand-label="props.brandLabel"
      :open="sidebarOpen"
      @close="sidebarOpen = false"
    />

    <div class="flex min-w-0 flex-1 flex-col">
      <Topbar
        :user-name="props.userName"
        :unread-notifications="props.unreadNotifications"
        :notifications-to="props.notificationsTo"
        @toggle-sidebar="sidebarOpen = !sidebarOpen"
        @logout="emit('logout')"
      />

      <main class="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <slot />
      </main>
    </div>
  </div>
</template>

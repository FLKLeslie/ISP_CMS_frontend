<script setup lang="ts">
import { Lightbulb, Megaphone, Bell } from 'lucide-vue-next'
const route = useRoute()
const { canOpen, can } = usePermissions()
const tabs = computed(() => [
  { label: 'Suggestions', to: '/admin/suggestions', icon: Lightbulb, visible: can('suggestions.view') },
  { label: 'Announcements', to: '/admin/announcements', icon: Megaphone, visible: can('announcements.manage') || canOpen('/admin/announcements') },
  { label: 'Notifications', to: '/admin/notifications', icon: Bell, visible: can('notifications.view') },
].filter(tab => tab.visible))
</script>
<template>
  <nav class="flex max-w-full gap-1 overflow-x-auto rounded-card border border-border bg-surface p-1" aria-label="Communications sections">
    <NuxtLink v-for="tab in tabs" :key="tab.to" :to="tab.to" class="inline-flex shrink-0 items-center gap-2 rounded-card px-3 py-2 text-sm font-medium text-text-secondary hover:bg-text-secondary/10 hover:text-text-primary" :class="route.path === tab.to ? 'bg-primary/10 text-text-primary' : ''">
      <component :is="tab.icon" class="h-4 w-4" aria-hidden="true" />{{ tab.label }}
    </NuxtLink>
  </nav>
</template>

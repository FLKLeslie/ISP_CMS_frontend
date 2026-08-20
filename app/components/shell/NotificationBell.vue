<script setup lang="ts">
import { Bell } from 'lucide-vue-next'
const props = defineProps<{ unreadCount: number; to: string }>()
</script>
<template>
  <NuxtLink :to="props.to" class="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-text-secondary/10 hover:text-text-primary"
    :aria-label="`Notifications${props.unreadCount > 0 ? `, ${props.unreadCount} unread` : ''}`">
    <Bell class="h-5 w-5" aria-hidden="true" />
    <span v-if="props.unreadCount > 0" class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white" aria-hidden="true">
      {{ props.unreadCount > 9 ? '9+' : props.unreadCount }}
    </span>
  </NuxtLink>
</template>

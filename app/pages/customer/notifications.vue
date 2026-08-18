<script setup lang="ts">
import { Bell } from 'lucide-vue-next'

definePageMeta({ layout: 'customer' })

const { listNotifications, markRead } = useNotificationsApi()

const { data, pending, error, refresh } = await useAsyncData('customer-notifications', () =>
  listNotifications({ ordering: '-created_at', page_size: 50 }),
)

const notifications = computed(() => data.value?.results ?? [])

async function handleMarkRead(id: string) {
  // Optimistic - flip it locally immediately, the API call confirms it
  // server-side. If it fails, refresh() below re-syncs the real state.
  const target = notifications.value.find((n) => n.id === id)
  if (target) target.is_read = true
  try {
    await markRead(id)
  } catch {
    await refresh()
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-semibold text-text-primary">Notifications</h1>

    <LoadingState v-if="pending" :rows="5" />
    <ErrorState v-else-if="error" @retry="refresh()" />
    <EmptyState
      v-else-if="!notifications.length"
      :icon="Bell"
      title="No notifications yet"
      description="We'll let you know here when there's something worth your attention."
    />

    <ul v-else class="space-y-2">
      <li
        v-for="notification in notifications"
        :key="notification.id"
        class="flex items-start justify-between gap-4 rounded-card border p-4"
        :class="notification.is_read ? 'border-border bg-surface' : 'border-accent/30 bg-accent/5'"
      >
        <div class="flex items-start gap-3">
          <span
            v-if="!notification.is_read"
            class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
            aria-hidden="true"
          />
          <div>
            <p class="text-sm font-medium text-text-primary">{{ notification.title }}</p>
            <p class="mt-0.5 text-sm text-text-secondary">{{ notification.message }}</p>
            <p class="mt-1.5 text-xs text-text-secondary">{{ formatRelativeTime(notification.created_at) }}</p>
          </div>
        </div>

        <button
          v-if="!notification.is_read"
          type="button"
          class="shrink-0 rounded-card border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-text-secondary/10"
          @click="handleMarkRead(notification.id)"
        >
          Mark read
        </button>
      </li>
    </ul>
  </div>
</template>

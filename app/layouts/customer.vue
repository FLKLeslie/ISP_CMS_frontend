<script setup lang="ts">
import { Bell, Home, MessageSquare, User, Wifi } from 'lucide-vue-next'
import type { NavItem } from '~/types/nav'
const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/customer', icon: Home },
  { label: 'Subscription', to: '/customer/subscription', icon: Wifi },
  { label: 'Notifications', to: '/customer/notifications', icon: Bell },
  { label: 'Suggestions', to: '/customer/suggestions', icon: MessageSquare },
  { label: 'Account', to: '/customer/account', icon: User },
]
const authStore = useAuthStore()
const { logout } = useAuthApi()
const { listNotifications } = useNotificationsApi()
const userName = computed(() => authStore.user ? `${authStore.user.first_name} ${authStore.user.last_name}`.trim() : '')
const unreadNotifications = ref(0)
const { data: unreadData } = await useAsyncData('customer-unread-count', () => listNotifications({ is_read: 'false', page_size: 1 }))
watchEffect(() => { if (unreadData.value) unreadNotifications.value = unreadData.value.count })
async function handleLogout() {
  if (authStore.refreshToken) { try { await logout(authStore.refreshToken) } catch { /* ignore */ } }
  authStore.clearSession(); await navigateTo('/login')
}
</script>
<template>
  <AppShell :nav-items="navItems" brand-label="ISMS" :user-name="userName" :unread-notifications="unreadNotifications" notifications-to="/customer/notifications" @logout="handleLogout">
    <slot />
  </AppShell>
</template>

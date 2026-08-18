<script setup lang="ts">
import {
  Bell,
  CreditCard,
  Home,
  Map,
  Megaphone,
  MessageSquare,
  RadioTower,
  Router,
  Users,
  Wifi,
} from 'lucide-vue-next'
import type { NavItem } from '~/types/nav'

// Per the approved architecture (§3) - devices is a group with 3
// sub-destinations (All Devices, Device Map, Access Points).
const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: Home },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Subscriptions', to: '/admin/subscriptions', icon: Wifi },
  { label: 'Payments', to: '/admin/payments', icon: CreditCard },
  { label: 'Devices', to: '/admin/devices', icon: Router },
  { label: 'Device Map', to: '/admin/devices/map', icon: Map },
  { label: 'Access Points', to: '/admin/access-points', icon: RadioTower },
  { label: 'Suggestions', to: '/admin/suggestions', icon: MessageSquare },
  { label: 'Announcements', to: '/admin/announcements', icon: Megaphone },
  { label: 'Notifications', to: '/admin/notifications', icon: Bell },
]

const authStore = useAuthStore()
const { logout } = useAuthApi()

const userName = computed(() =>
  authStore.user ? `${authStore.user.first_name} ${authStore.user.last_name}`.trim() : '',
)
// TODO: wire to a real admin-facing notifications count once that
// composable/page exist.
const unreadNotifications = 0

async function handleLogout() {
  if (authStore.refreshToken) {
    try {
      await logout(authStore.refreshToken)
    } catch {
      /* ignore - proceed with local logout regardless */
    }
  }
  authStore.clearSession()
  await navigateTo('/login')
}
</script>

<template>
  <AppShell
    :nav-items="navItems"
    brand-label="ISMS Admin"
    :user-name="userName"
    :unread-notifications="unreadNotifications"
    notifications-to="/admin/notifications"
    @logout="handleLogout"
  >
    <slot />
  </AppShell>
</template>

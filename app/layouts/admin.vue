<script setup lang="ts">
import { Bell, CreditCard, Home, Map, Megaphone, MessageSquare, RadioTower, Router, Users, Wifi } from 'lucide-vue-next'
import type { NavItem } from '~/types/nav'

const { fetchAdminDashboard } = useDashboardApi()

// Fetched once per layout mount, purely to drive the "Unregistered
// Devices" sidebar badge below — the admin dashboard page itself does its
// own separate fetch for its full stats, this is intentionally minimal
// and doesn't block rendering the shell (errors here just leave the badge
// at 0, they never block navigation).
const pendingUnregisteredDevices = ref(0)
onMounted(async () => {
  try {
    const dashboard = await fetchAdminDashboard()
    pendingUnregisteredDevices.value = dashboard.pending_unregistered_devices
  } catch {
    // Sidebar badge just stays at 0 — not worth surfacing an error for a
    // secondary indicator when the main page content will show its own
    // error state if the API is genuinely down.
  }
})

// navItems must be computed (not a plain const) so the "Unregistered
// Devices" badge updates reactively once pendingUnregisteredDevices loads
// in, rather than being frozen at whatever it was on first render.
const navItems = computed<NavItem[]>(() => [
  { label: 'Dashboard', to: '/admin', icon: Home },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Subscriptions', to: '/admin/subscriptions', icon: Wifi },
  { label: 'Payments', to: '/admin/payments', icon: CreditCard },
  { label: 'Devices', to: '/admin/devices', icon: Router },
  {
    label: 'Unregistered Devices',
    to: '/admin/devices/unregistered',
    icon: Router,
    badge: pendingUnregisteredDevices.value,
  },
  { label: 'Device Map', to: '/admin/devices/map', icon: Map },
  { label: 'Access Points', to: '/admin/access-points', icon: RadioTower },
  { label: 'Suggestions', to: '/admin/suggestions', icon: MessageSquare },
  { label: 'Announcements', to: '/admin/announcements', icon: Megaphone },
  { label: 'Notifications', to: '/admin/notifications', icon: Bell },
])
const authStore = useAuthStore()
const { logout } = useAuthApi()
const userName = computed(() => authStore.user ? `${authStore.user.first_name} ${authStore.user.last_name}`.trim() : '')
const unreadNotifications = 0
async function handleLogout() {
  if (authStore.refreshToken) { try { await logout(authStore.refreshToken) } catch { /* ignore */ } }
  authStore.clearSession(); await navigateTo('/login')
}
</script>
<template>
  <AppShell :nav-items="navItems" brand-label="ISMS Admin" :user-name="userName" :unread-notifications="unreadNotifications" notifications-to="/admin/notifications" @logout="handleLogout">
    <slot />
  </AppShell>
</template>
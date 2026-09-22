<script setup lang="ts">
import { Bell, CreditCard, Home, Map, Megaphone, MessageSquare, RadioTower, Router, TrendingUp, Users, Wifi } from 'lucide-vue-next'
import type { NavItem } from '~/types/nav'

const { fetchAdminDashboard } = useDashboardApi()
const { listRouters } = useMikroTikApi()

// Fetched once per layout mount, purely to drive sidebar badges below —
// each destination page does its own separate full fetch; errors here
// just leave a badge at 0, they never block navigation.
const pendingUnregisteredDevices = ref(0)
const pendingMikroTikRouters = ref(0)
onMounted(async () => {
  try {
    const dashboard = await fetchAdminDashboard()
    pendingUnregisteredDevices.value = dashboard.pending_unregistered_devices
  } catch {
    // Sidebar badge just stays at 0 — not worth surfacing an error for a
    // secondary indicator when the main page content will show its own
    // error state if the API is genuinely down.
  }
  try {
    const pendingRouters = await listRouters({ status: 'PENDING', page_size: 1 })
    pendingMikroTikRouters.value = pendingRouters.count
  } catch {
    // Same rationale as above.
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
  { label: 'Revenue', to: '/admin/revenue', icon: TrendingUp },
  { label: 'Devices', to: '/admin/devices', icon: Router },
  {
    label: 'Unregistered Devices',
    to: '/admin/devices/unregistered',
    icon: Router,
    badge: pendingUnregisteredDevices.value,
  },
  { label: 'Device Map', to: '/admin/devices/map', icon: Map },
  { label: 'Access Points', to: '/admin/access-points', icon: RadioTower },
  {
    label: 'MikroTik Routers',
    to: '/admin/microtik',
    icon: Router,
    badge: pendingMikroTikRouters.value,
  },
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
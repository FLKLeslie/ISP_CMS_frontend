<script setup lang="ts">
// One distinct, self-explanatory icon per destination (no two items share one):
// dashboard panels, people, a dated plan, a card, a rising line, device inventory,
// a map pin, a mast, a router, the combined communications area, and My Account.
import {
  CalendarClock, CreditCard, LayoutDashboard, MapPinned, Radio, RadioTower,
  Router, ScanSearch, TrendingUp, User as UserIcon, Users, Settings2, ScrollText,
} from 'lucide-vue-next'
import type { NavItem } from '~/types/nav'

const { fetchAdminDashboard } = useDashboardApi()
const { listRouters } = useMikroTikApi()
const { fetchProfile } = useAuthApi()
const authStore = useAuthStore()
const route = useRoute()
const { can, canOpen } = usePermissions()

// Fetched once per layout mount, purely to drive sidebar badges below -
// each destination page does its own separate full fetch; errors here
// just leave a badge at 0, they never block navigation. Only asked for when the
// account may see the thing the badge counts (otherwise the server would refuse).
const pendingUnregisteredDevices = ref(0)
const pendingMikroTikRouters = ref(0)

// What this account may do can change while it is signed in (a super administrator edits the
// permissions), and a session saved by an older version of the app has no list at all - so on
// every mount, and whenever the tab regains focus, ask the server again. Throttled to once a
// minute; failures are ignored (the server still enforces everything).
let lastProfileRefresh = 0
async function refreshProfile(force = false) {
  if (!force && Date.now() - lastProfileRefresh < 60_000) return
  lastProfileRefresh = Date.now()
  try { authStore.setUser(await fetchProfile()) } catch { /* keep what we have */ }
}
function onVisible() { if (document.visibilityState === 'visible') void refreshProfile() }

async function loadBadges() {
  if (authStore.mustChangePassword) return // nothing else works until the new password is chosen
  if (can('dashboard.view') && can('unregistered_devices.view')) {
    try {
      const dashboard = await fetchAdminDashboard()
      pendingUnregisteredDevices.value = dashboard.pending_unregistered_devices
    } catch {
      // Sidebar badge just stays at 0 - not worth surfacing an error for a
      // secondary indicator when the main page content will show its own
      // error state if the API is genuinely down.
    }
  }
  if (can('microtik.view')) {
    try {
      const pendingRouters = await listRouters({ status: 'PENDING', page_size: 1 })
      pendingMikroTikRouters.value = pendingRouters.count
    } catch {
      // Same rationale as above.
    }
  }
}
onMounted(async () => {
  await refreshProfile(true)
  await loadBadges()
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))

// If a refresh just took away the page the person is on, send them somewhere they can be.
watch(() => authStore.user?.permissions, () => {
  const subject = authStore.user
  if (!subject) return
  const redirect = resolveAuthRedirect(route.path, subject)
  if (redirect) void navigateTo(redirect)
}, { deep: true })

// navItems must be computed (not a plain const) so badges update reactively once they load
// in, and so the menu follows the account's permissions as they change. Each item is shown
// only if the account may open its page (utils/authPaths.ts decides) - so the menu never
// offers a page that would turn the person away.
const communicationsPath = computed(() => can('suggestions.view') ? '/admin/suggestions' : canOpen('/admin/announcements') ? '/admin/announcements' : '/admin/notifications')
const allNavItems = computed<NavItem[]>(() => [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Subscriptions', to: '/admin/subscriptions', icon: CalendarClock },
  { label: 'Payments', to: '/admin/payments', icon: CreditCard },
  { label: 'Revenue', to: '/admin/revenue', icon: TrendingUp },
  { label: 'Devices', to: '/admin/devices', icon: Radio },
  {
    label: 'Unregistered Devices',
    to: '/admin/devices/unregistered',
    icon: ScanSearch,
    badge: pendingUnregisteredDevices.value,
  },
  { label: 'Device Map', to: '/admin/devices/map', icon: MapPinned },
  { label: 'Access Points', to: '/admin/access-points', icon: RadioTower },
  {
    label: 'MikroTik Routers',
    to: '/admin/microtik',
    icon: Router,
    badge: pendingMikroTikRouters.value,
  },
  { label: 'Communications', to: communicationsPath.value, icon: Settings2, activePaths: ['/admin/suggestions', '/admin/announcements', '/admin/notifications'] },
  { label: 'My Account', to: '/admin/account', icon: UserIcon },
])
const adminMenuItems = computed<NavItem[]>(() => authStore.mustChangePassword ? [] : ([
  { label: 'Customer Accounts', to: '/admin/superadmin/credentials', icon: Users },
  { label: 'Staff Accounts', to: '/admin/superadmin/staff', icon: Users },
  { label: 'Audit Log', to: '/admin/superadmin/audit-log', icon: ScrollText },
].filter((item) => canOpen(item.to))))
const navItems = computed<NavItem[]>(() => {
  // Until a forced password change is done, the only page is the one to do it on.
  if (authStore.mustChangePassword) return allNavItems.value.filter((item) => item.to === '/admin/account')
  return allNavItems.value.filter((item) => item.label === 'Communications' ? can('suggestions.view') || canOpen('/admin/announcements') || can('notifications.view') : canOpen(item.to))
})
const sectionLabel = computed(() => (authStore.user ? ROLE_LABELS[authStore.user.role] : 'Staff'))
const notificationsTo = computed(() => (canOpen('/admin/notifications') ? '/admin/notifications' : '/admin/account'))
const { logout } = useAuthApi()
const userName = computed(() => authStore.user ? `${authStore.user.first_name} ${authStore.user.last_name}`.trim() : '')
const unreadNotifications = 0
async function handleLogout() {
  if (authStore.refreshToken) { try { await logout(authStore.refreshToken) } catch { /* ignore */ } }
  // Back to the door this person came in by (staff to the staff sign-in).
  const signInPath = loginPathForRole(authStore.user?.role)
  authStore.clearSession(); await navigateTo(signInPath)
}
</script>
<template>
  <AppShell :nav-items="navItems" :admin-menu-items="adminMenuItems" :section-label="sectionLabel" :user-name="userName" :unread-notifications="unreadNotifications" :notifications-to="notificationsTo" @logout="handleLogout">
    <slot />
  </AppShell>
</template>
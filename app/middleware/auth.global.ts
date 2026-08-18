/**
 * Runs on every navigation. Three jobs:
 *   1. Hydrate auth state from localStorage on first load.
 *   2. Unauthenticated + not on /login -> send to /login.
 *   3. Authenticated + on /login or / -> send to the right portal for
 *      their role. Authenticated but in the WRONG portal (a customer
 *      hitting /admin/*, or vice versa) -> redirect to their own portal,
 *      never a bare 403 - role mismatches shouldn't feel like errors.
 */
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  if (!authStore.user && !authStore.accessToken) {
    authStore.hydrate()
  }

  const isLoginPage = to.path === '/login'
  const isRoot = to.path === '/'
  const isCustomerRoute = to.path.startsWith('/customer')
  const isAdminRoute = to.path.startsWith('/admin')

  if (!authStore.isAuthenticated) {
    if (isLoginPage) return
    return navigateTo('/login')
  }

  const homeForRole = authStore.user?.role === 'ADMIN' ? '/admin' : '/customer'

  if (isLoginPage || isRoot) {
    return navigateTo(homeForRole)
  }
  if (isAdminRoute && authStore.user?.role !== 'ADMIN') {
    return navigateTo('/customer')
  }
  if (isCustomerRoute && authStore.user?.role !== 'CUSTOMER') {
    return navigateTo('/admin')
  }
})

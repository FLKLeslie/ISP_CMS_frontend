export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  if (!authStore.user && !authStore.accessToken) authStore.hydrate()

  const isLoginPage = to.path === '/login'
  const isRoot = to.path === '/'
  const isCustomerRoute = to.path.startsWith('/customer')
  const isAdminRoute = to.path.startsWith('/admin')

  if (!authStore.isAuthenticated) {
    if (isLoginPage) return
    return navigateTo('/login')
  }
  const homeForRole = authStore.user?.role === 'ADMIN' ? '/admin' : '/customer'
  if (isLoginPage || isRoot) return navigateTo(homeForRole)
  if (isAdminRoute && authStore.user?.role !== 'ADMIN') return navigateTo('/customer')
  if (isCustomerRoute && authStore.user?.role !== 'CUSTOMER') return navigateTo('/admin')
})

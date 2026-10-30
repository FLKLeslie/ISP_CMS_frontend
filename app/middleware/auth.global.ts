// The rules themselves live in utils/authPaths.ts (resolveAuthRedirect), as a plain
// function so each case can be tested. This only feeds it the current state.
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  if (!authStore.user && !authStore.accessToken) authStore.hydrate()

  const role = authStore.isAuthenticated ? (authStore.user?.role ?? null) : null
  const redirect = resolveAuthRedirect(to.path, role)
  if (redirect) return navigateTo(redirect)
})

// The rules themselves live in utils/authPaths.ts (resolveAuthRedirect), as a plain
// function so each case can be tested (npm run check:access). This only feeds it the
// current state: who is signed in, what they may do, and whether they must first pick a
// new password.
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  if (!authStore.user && !authStore.accessToken) authStore.hydrate()

  const subject = authStore.isAuthenticated ? authStore.user : null
  const redirect = resolveAuthRedirect(to.path, subject)
  if (redirect) return navigateTo(redirect)
})

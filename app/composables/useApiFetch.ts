import type { FetchOptions } from 'ofetch'
import type { RefreshResponse, User } from '~/types/api/auth'

let refreshPromise: Promise<boolean> | null = null
let lastPermissionRefresh = 0

// After the server refuses something, our idea of what this account may do might be out of
// date (a super administrator may have just changed it). Quietly ask for the profile again -
// at most once every 30 seconds - so the menus and buttons catch up. Never awaited, never throws.
async function refreshPermissionsAfterRefusal() {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated || Date.now() - lastPermissionRefresh < 30_000) return
  lastPermissionRefresh = Date.now()
  try {
    const config = useRuntimeConfig()
    const profile = await $fetch<User>('/api/auth/profile/', {
      baseURL: config.public.apiBase, headers: { Authorization: `Bearer ${authStore.accessToken}` },
    })
    authStore.setUser(profile)
  } catch { /* the next refusal will try again */ }
}

async function performRefresh(): Promise<boolean> {
  const authStore = useAuthStore()
  const config = useRuntimeConfig()
  if (!authStore.refreshToken) return false
  try {
    const response = await $fetch<RefreshResponse>('/api/auth/refresh/', {
      baseURL: config.public.apiBase, method: 'POST', body: { refresh: authStore.refreshToken },
    })
    authStore.setTokens(response)
    return true
  } catch {
    authStore.clearSession()
    return false
  }
}

export async function apiFetch<T>(path: string, options: FetchOptions<'json'> = {}): Promise<T> {
  const authStore = useAuthStore()
  const config = useRuntimeConfig()
  const doFetch = () =>
    $fetch<T>(path, {
      baseURL: config.public.apiBase,
      ...options,
      headers: {
        ...(options.headers as Record<string, string> | undefined),
        ...(authStore.accessToken ? { Authorization: `Bearer ${authStore.accessToken}` } : {}),
      },
    })
  try {
    return await doFetch()
  } catch (error: any) {
    const status = error?.response?.status ?? error?.statusCode
    if (status === 401 && authStore.refreshToken) {
      // Noted BEFORE the refresh, which clears the session when it fails: an administrator
      // whose session ran out goes back to the admin sign-in, not the customers' one.
      const roleBefore = authStore.user?.role
      refreshPromise ??= performRefresh().finally(() => { refreshPromise = null })
      const refreshed = await refreshPromise
      if (refreshed) return await doFetch()
      await navigateTo(loginPathForRole(roleBefore))
    }
    if (status === 403) {
      const body = error?.data?.errors ?? error?.data
      if (body?.code === 'password_change_required' && authStore.user) {
        // The server says this account must pick a new password first: hold it on its account page.
        authStore.setUser({ ...authStore.user, must_change_password: true })
        await navigateTo(accountPathFor(authStore.user))
      } else {
        void refreshPermissionsAfterRefusal()
      }
    }
    throw error
  }
}

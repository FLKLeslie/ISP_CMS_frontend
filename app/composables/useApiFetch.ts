import type { FetchOptions } from 'ofetch'
import type { RefreshResponse } from '~/types/api/auth'

/**
 * Every API call in the app goes through this function - never call
 * Nuxt's raw $fetch directly against the Django API. It:
 *   1. Attaches the JWT access token automatically.
 *   2. On a 401, refreshes the token exactly once and retries the
 *      original request - concurrent 401s from multiple in-flight
 *      requests are coalesced into a single refresh call, not one each.
 *   3. If the refresh itself fails (refresh token expired/blacklisted),
 *      clears the session and sends the user to /login.
 */

// Module-level (not per-call) so concurrent requests share one in-flight
// refresh instead of each independently hitting /api/auth/refresh/.
let refreshPromise: Promise<boolean> | null = null

async function performRefresh(): Promise<boolean> {
  const authStore = useAuthStore()
  const config = useRuntimeConfig()

  if (!authStore.refreshToken) return false

  try {
    const response = await $fetch<RefreshResponse>('/api/auth/refresh/', {
      baseURL: config.public.apiBase,
      method: 'POST',
      body: { refresh: authStore.refreshToken },
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
      refreshPromise ??= performRefresh().finally(() => {
        refreshPromise = null
      })
      const refreshed = await refreshPromise

      if (refreshed) {
        return await doFetch()
      }
      await navigateTo('/login')
    }
    throw error
  }
}

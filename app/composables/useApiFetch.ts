import type { FetchOptions } from 'ofetch'
import type { RefreshResponse } from '~/types/api/auth'

let refreshPromise: Promise<boolean> | null = null

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
      refreshPromise ??= performRefresh().finally(() => { refreshPromise = null })
      const refreshed = await refreshPromise
      if (refreshed) return await doFetch()
      await navigateTo('/login')
    }
    throw error
  }
}

import { defineStore } from 'pinia'
import type { LoginResponse, RefreshResponse, User } from '~/types/api/auth'

const ACCESS_KEY = 'isms-access-token'
const REFRESH_KEY = 'isms-refresh-token'
const USER_KEY = 'isms-user'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)

  /** Called once, right after a successful login. */
  function setSession(payload: LoginResponse) {
    accessToken.value = payload.access
    refreshToken.value = payload.refresh
    user.value = payload.user
    persist()
  }

  /**
   * Called after a token refresh. `refresh` is only present when SimpleJWT
   * rotated it (it always does, per our settings) - but this stays
   * defensive in case that setting ever changes.
   */
  function setTokens(payload: RefreshResponse) {
    accessToken.value = payload.access
    if (payload.refresh) refreshToken.value = payload.refresh
    persist()
  }

  function clearSession() {
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    if (import.meta.client) {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem(USER_KEY)
    }
  }

  function persist() {
    if (!import.meta.client) return
    if (accessToken.value) localStorage.setItem(ACCESS_KEY, accessToken.value)
    if (refreshToken.value) localStorage.setItem(REFRESH_KEY, refreshToken.value)
    if (user.value) localStorage.setItem(USER_KEY, JSON.stringify(user.value))
  }

  /** Restores session state from localStorage - called once on app load. */
  function hydrate() {
    if (!import.meta.client) return
    const storedAccess = localStorage.getItem(ACCESS_KEY)
    const storedRefresh = localStorage.getItem(REFRESH_KEY)
    const storedUser = localStorage.getItem(USER_KEY)
    if (storedAccess && storedRefresh && storedUser) {
      accessToken.value = storedAccess
      refreshToken.value = storedRefresh
      user.value = JSON.parse(storedUser)
    }
  }

  return {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    setSession,
    setTokens,
    clearSession,
    hydrate,
  }
})

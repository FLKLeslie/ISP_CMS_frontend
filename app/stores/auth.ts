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
  // What the account may do, as last told by the server. (An account stored by an older version
  // of the app has no list until the next refreshProfile() - hasPermission treats that as none.)
  const permissions = computed<string[]>(() => user.value?.permissions ?? [])
  const mustChangePassword = computed(() => !!user.value?.must_change_password)

  function setSession(payload: LoginResponse) {
    accessToken.value = payload.access; refreshToken.value = payload.refresh; user.value = payload.user
    persist()
  }
  function setTokens(payload: RefreshResponse) {
    accessToken.value = payload.access
    if (payload.refresh) refreshToken.value = payload.refresh
    persist()
  }
  /** Replace the stored user (e.g. after loading the profile again) and remember it. */
  function setUser(next: User) {
    user.value = next
    persist()
  }
  /** The forced password change is done: stop holding the account on its account page. */
  function markPasswordChanged() {
    if (user.value) setUser({ ...user.value, must_change_password: false })
  }
  function clearSession() {
    user.value = null; accessToken.value = null; refreshToken.value = null
    if (import.meta.client) { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); localStorage.removeItem(USER_KEY) }
  }
  function persist() {
    if (!import.meta.client) return
    if (accessToken.value) localStorage.setItem(ACCESS_KEY, accessToken.value)
    if (refreshToken.value) localStorage.setItem(REFRESH_KEY, refreshToken.value)
    if (user.value) localStorage.setItem(USER_KEY, JSON.stringify(user.value))
  }
  function hydrate() {
    if (!import.meta.client) return
    const storedAccess = localStorage.getItem(ACCESS_KEY)
    const storedRefresh = localStorage.getItem(REFRESH_KEY)
    const storedUser = localStorage.getItem(USER_KEY)
    if (storedAccess && storedRefresh && storedUser) {
      accessToken.value = storedAccess; refreshToken.value = storedRefresh; user.value = JSON.parse(storedUser)
    }
  }
  return {
    user, accessToken, refreshToken, isAuthenticated, permissions, mustChangePassword,
    setSession, setTokens, setUser, markPasswordChanged, clearSession, hydrate,
  }
})

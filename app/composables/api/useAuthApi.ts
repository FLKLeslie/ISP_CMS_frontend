import type { LoginResponse, User } from '~/types/api/auth'
export function useAuthApi() {
  function login(email: string, password: string) {
    return apiFetch<LoginResponse>('/api/auth/login/', { method: 'POST', body: { email, password } })
  }
  function logout(refresh: string) {
    return apiFetch<{ detail: string }>('/api/auth/logout/', { method: 'POST', body: { refresh } })
  }
  function fetchProfile() { return apiFetch<User>('/api/auth/profile/') }
  function updateProfile(payload: Partial<Pick<User, 'first_name' | 'last_name' | 'phone_number'>>) {
    return apiFetch<User>('/api/auth/profile/', { method: 'PUT', body: payload })
  }
  return { login, logout, fetchProfile, updateProfile }
}

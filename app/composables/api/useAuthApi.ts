import type { LoginResponse, User } from '~/types/api/auth'
export function useAuthApi() {
  function login(email: string, password: string) {
    return apiFetch<LoginResponse>('/api/auth/login/', { method: 'POST', body: { email, password } })
  }
  function logout(refresh: string) {
    return apiFetch<{ detail: string }>('/api/auth/logout/', { method: 'POST', body: { refresh } })
  }
  function fetchProfile() { return apiFetch<User>('/api/auth/profile/') }
  // Only phone_number is actually writable here - name/email are
  // read-only on this endpoint (an administrator edits those; see
  // useCustomersApi.updateCustomer). Uses PATCH since it's a partial update.
  function updateProfile(payload: { phone_number: string }) {
    return apiFetch<User>('/api/auth/profile/', { method: 'PATCH', body: payload })
  }
  function changePassword(oldPassword: string, newPassword: string) {
    return apiFetch<{ detail: string }>('/api/auth/change-password/', {
      method: 'POST', body: { old_password: oldPassword, new_password: newPassword },
    })
  }
  return { login, logout, fetchProfile, updateProfile, changePassword }
}

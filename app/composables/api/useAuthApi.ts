import type { LoginResponse, User } from '~/types/api/auth'
export function useAuthApi() {
  // The CUSTOMER sign-in. Refuses an administrator's credentials like a wrong password.
  function login(email: string, password: string) {
    return apiFetch<LoginResponse>('/api/auth/login/', { method: 'POST', body: { email, password } })
  }
  // The ADMINISTRATOR sign-in - a different endpoint, admitting administrators only.
  function adminLogin(email: string, password: string) {
    return apiFetch<LoginResponse>('/api/auth/admin/login/', { method: 'POST', body: { email, password } })
  }
  function logout(refresh: string) {
    return apiFetch<{ detail: string }>('/api/auth/logout/', { method: 'POST', body: { refresh } })
  }
  function fetchProfile() { return apiFetch<User>('/api/auth/profile/') }
  // Staff can update their own name and phone; email is always read-only here.
  function updateProfile(payload: { first_name?: string; last_name?: string; phone_number?: string }) {
    return apiFetch<User>('/api/auth/profile/', { method: 'PATCH', body: payload })
  }
  function changePassword(oldPassword: string, newPassword: string) {
    return apiFetch<{ detail: string }>('/api/auth/change-password/', {
      method: 'POST', body: { old_password: oldPassword, new_password: newPassword },
    })
  }
  return { login, adminLogin, logout, fetchProfile, updateProfile, changePassword }
}

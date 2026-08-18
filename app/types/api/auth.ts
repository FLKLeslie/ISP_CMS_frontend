/**
 * Matches accounts/serializers.py's UserProfileSerializer and the login
 * response shape from accounts/views.py's LoginView exactly - field names
 * and types are not guessed, they're read directly off the backend.
 */
export type UserRole = 'ADMIN' | 'CUSTOMER'

export interface User {
  uuid: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  role: UserRole
  is_active: boolean
  date_joined: string
}

export interface LoginResponse {
  access: string
  refresh: string
  user: User
}

/**
 * SimpleJWT's TokenRefreshSerializer includes a new `refresh` value when
 * ROTATE_REFRESH_TOKENS is enabled (it is, in isms_backend/settings.py) -
 * the old refresh token is blacklisted server-side the moment this
 * response is issued, so the new one MUST replace it in storage.
 */
export interface RefreshResponse {
  access: string
  refresh?: string
}

export type UserRole = 'ADMIN' | 'CUSTOMER'
export interface User {
  uuid: string; first_name: string; last_name: string; email: string
  phone_number: string; role: UserRole; is_active: boolean; date_joined: string
}
export interface LoginResponse { access: string; refresh: string; user: User }
export interface RefreshResponse { access: string; refresh?: string }

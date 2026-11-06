// The five roles (backend: accounts/roles.py). "ADMIN" is the original Administrator role.
// A staff role is a label and a starting template; what an account can actually do is its
// `permissions` list (backend accounts/access.py).
export type StaffRole = 'SUPERADMIN' | 'ADMIN' | 'TECHNICIAN' | 'FINANCE'
export type UserRole = StaffRole | 'CUSTOMER'
export interface User {
  uuid: string; first_name: string; last_name: string; email: string
  phone_number: string; role: UserRole; is_active: boolean; date_joined: string
  /** Every permission key this account holds (empty for a customer). The server still checks each request. */
  permissions: string[]
  /** True after a super administrator reset the account to the default password: it can do nothing until it picks a new one. */
  must_change_password: boolean
}
export interface LoginResponse { access: string; refresh: string; user: User }
export interface RefreshResponse { access: string; refresh?: string }

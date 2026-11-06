import type { StaffRole } from '~/types/api/auth'

/** A staff account as listed on the Staff accounts page. Never carries a password. */
export interface StaffAccount {
  uuid: string; email: string; first_name: string; last_name: string; phone_number: string
  role: StaffRole; is_active: boolean; must_change_password: boolean
  date_joined: string; last_login: string | null
  /** Every permission the account holds (a super administrator holds all of them). */
  permissions: string[]
  /** True when the account has never been customised and simply follows its role's template. */
  uses_role_template: boolean
}

export interface StaffCreatePayload {
  email: string; first_name: string; last_name: string; phone_number: string; role: StaffRole
  /** Omit to give the role's template; a super administrator takes none. */
  permissions?: string[]
  password: string; confirm_password: string
  /** Default true: the new account must choose its own password at its first sign-in. */
  require_password_change?: boolean
}

export interface StaffUpdatePayload {
  first_name?: string; last_name?: string; phone_number?: string; role?: StaffRole; is_active?: boolean
  /** A list saves exactly those; null puts the account back on its role's template. */
  permissions?: string[] | null
}

/** One row of the customer accounts page: who the customer is. No password, no hash. */
export interface CustomerCredential {
  id: string; user_uuid: string; email: string; first_name: string; last_name: string; phone_number: string
  status: 'ACTIVE' | 'SUSPENDED'; is_active: boolean; must_change_password: boolean; last_login: string | null
  customer_type?: 'RESIDENTIAL' | 'BUSINESS'; company_name?: string; alternate_phone?: string; landmark?: string
  address?: string; city?: string; country?: string; router_mac_address?: string; router_ip?: string | null
  router_hostname?: string; registration_date?: string; notes?: string
}

/** What the server insists on before it will reset someone else's password (backend ResetConfirmationSerializer). */
export interface ResetConfirmation {
  confirm_email: string   // the target account's email, typed out
  admin_password: string  // the signed-in superadmin's OWN password
  acknowledged: boolean
}

export interface PasswordResetResult { detail: string; default_password: string; must_change_password: boolean }

// --- the permission picker ---------------------------------------------------------------
export interface PermissionInfo { key: string; label: string; description: string; group: string; requires: string[] }
export interface PermissionCatalog {
  groups: { key: string; label: string }[]
  permissions: PermissionInfo[]
  /** The starting permissions of each configurable role (ADMIN, TECHNICIAN, FINANCE). */
  role_templates: Record<string, string[]>
}

// --- the audit log -----------------------------------------------------------------------
export interface AuditEntry {
  id: string; created_at: string; action: string
  actor_uuid: string | null; actor_email: string; actor_name: string; actor_role: string
  target_type: string; target_id: string; target_repr: string
  /** Free-form detail; automatic entries carry {fields: {name: [old, new]}}. Secrets are never in it. */
  changes: Record<string, any>
  request_id: string; ip_address: string | null; user_agent: string
  method: string; path: string; status_code: number | null
}

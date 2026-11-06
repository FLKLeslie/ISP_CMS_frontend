// Where people sign in, and who may be where.
//
// There are TWO sign-in pages, one per kind of account, at different URLs:
//
//   /login         customers          (the address printed on bills, shared with the public)
//   /staff/login   staff              (not linked from anywhere a customer looks)
//
// "Staff" is every non-customer role: super administrator, administrator, technician and
// financial manager. They share one door and one app area (/admin/...), but each ACCOUNT may
// only open the pages its PERMISSIONS include - the super administrator chooses them per
// account (backend accounts/access.py). ADMIN_PAGE_RULES below is the ONE place that maps a
// page to the permission it needs; the route guard, the sidebar and the links between pages
// all ask it.
//
// The separation that matters is enforced by the SERVER, not by these pages: the customer
// sign-in endpoint refuses a staff member's correct credentials exactly like a wrong
// password (and vice versa), and every API endpoint checks the caller's permission again.
// This file only decides what to SHOW and where to redirect; hiding a page here never
// replaces a server-side check.
//
// TO MOVE THE STAFF SIGN-IN to another URL: change ADMIN_LOGIN_PATH below AND rename
// the page file app/pages/staff/login.vue to match (e.g. pages/ops/login.vue for
// '/ops/login'). Nothing else refers to the path.
import type { StaffRole, UserRole } from '~/types/api/auth'

export const CUSTOMER_LOGIN_PATH = '/login'
export const ADMIN_LOGIN_PATH = '/staff/login'
/** Where an account that must pick a new password is kept until it has. */
export const STAFF_ACCOUNT_PATH = '/admin/account'
export const CUSTOMER_ACCOUNT_PATH = '/customer/account'

// --- roles ---------------------------------------------------------------------------
export const STAFF_ROLES: readonly StaffRole[] = ['SUPERADMIN', 'ADMIN', 'TECHNICIAN', 'FINANCE']

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: 'Super administrator',
  ADMIN: 'Administrator',
  TECHNICIAN: 'Technician',
  FINANCE: 'Financial manager',
  CUSTOMER: 'Customer',
}

/** One line on what each staff role starts with - shown when choosing a role. */
export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  SUPERADMIN: 'Everything, plus staff accounts, permissions, password resets and the audit log.',
  ADMIN: 'Everything operational. You can add or remove individual permissions.',
  TECHNICIAN: 'Devices, access points, MikroTik routers and a read-only look at customers. You can add or remove individual permissions.',
  FINANCE: 'Payments, revenue and a read-only look at customers and subscriptions. You can add or remove individual permissions.',
}

export const isStaffRole = (role?: UserRole | string | null): role is StaffRole =>
  !!role && (STAFF_ROLES as readonly string[]).includes(role)
export const isSuperAdmin = (role?: UserRole | null): boolean => role === 'SUPERADMIN'

// --- permissions ---------------------------------------------------------------------
/** The bits of a signed-in user the access rules need. (The auth store's user fits this.) */
export interface AccessSubject {
  role: UserRole
  permissions?: readonly string[] | null
  must_change_password?: boolean
}

/**
 * Does this account hold `key`? A super administrator holds everything. For anyone else the
 * list the server sent at sign-in is the truth (a customer's is empty). This only decides
 * what to show - the server decides what is allowed.
 */
export function hasPermission(subject: AccessSubject | null | undefined, key: string): boolean {
  if (!subject || !isStaffRole(subject.role)) return false
  if (subject.role === 'SUPERADMIN') return true
  return !!subject.permissions && subject.permissions.includes(key)
}

export const hasAnyPermission = (subject: AccessSubject | null | undefined, keys: readonly string[]): boolean =>
  keys.some((key) => hasPermission(subject, key))

// --- which staff page needs which permission -----------------------------------------
/**
 * Each rule covers a path AND everything under it; the LONGEST matching prefix wins, so a
 * more specific rule can narrow a broader one. `exact` rules match that path only (the
 * dashboard is '/admin' itself; every other page also starts with '/admin/'). `permission`
 * is a key, a list of keys (any one will do), or null for "any member of staff".
 * A path that matches no rule is NOT open to everyone - it needs UNKNOWN_PAGE_PERMISSION
 * (super administrators only), so a page added later stays locked until someone
 * deliberately opens it here.
 */
export interface PageRule { prefix: string; permission: string | readonly string[] | null; exact?: boolean }
export const UNKNOWN_PAGE_PERMISSION = 'staff.manage'
export const ADMIN_PAGE_RULES: readonly PageRule[] = [
  { prefix: '/admin', permission: 'dashboard.view', exact: true },
  { prefix: STAFF_ACCOUNT_PATH, permission: null }, // everyone on staff manages their own account
  { prefix: '/admin/notifications', permission: 'notifications.view' },
  { prefix: '/admin/customers', permission: 'customers.view' },
  { prefix: '/admin/subscriptions', permission: 'subscriptions.view' }, // plans are managed from here too
  { prefix: '/admin/suggestions', permission: 'suggestions.view' },
  { prefix: '/admin/announcements', permission: 'announcements.manage' },
  { prefix: '/admin/payments', permission: 'payments.view' },
  { prefix: '/admin/revenue', permission: 'revenue.view' },
  { prefix: '/admin/devices', permission: 'devices.view' },
  { prefix: '/admin/devices/unregistered', permission: 'unregistered_devices.view' },
  { prefix: '/admin/access-points', permission: 'access_points.view' },
  { prefix: '/admin/microtik', permission: 'microtik.view' },
  { prefix: '/admin/superadmin/staff', permission: 'staff.manage' },
  { prefix: '/admin/superadmin/credentials', permission: 'passwords.reset' },
  { prefix: '/admin/superadmin/audit-log', permission: 'audit.view' },
]

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)

/** Strips any query string / hash, so '/admin/customers?status=SUSPENDED' is judged as '/admin/customers'. */
const pathOnly = (path: string) => path.split(/[?#]/)[0] || '/'

/** May this account open this /admin/... page? (false for customers and signed-out visitors) */
export function canAccessAdminPath(path: string, subject: AccessSubject | null | undefined): boolean {
  if (!subject || !isStaffRole(subject.role)) return false
  const clean = pathOnly(path)
  let best: PageRule | null = null
  for (const rule of ADMIN_PAGE_RULES) {
    const matches = rule.exact ? clean === rule.prefix : isUnder(clean, rule.prefix)
    if (matches && (!best || rule.prefix.length > best.prefix.length)) best = rule
  }
  const needed = best ? best.permission : UNKNOWN_PAGE_PERMISSION
  if (needed === null) return true
  return hasAnyPermission(subject, typeof needed === 'string' ? [needed] : needed)
}

// --- landing pages and sign-in -------------------------------------------------------
/**
 * Where a staff member lands, best first. Their first page is the dashboard - but an account
 * given no dashboard permission lands on the first area it CAN open instead, and an account
 * that can open nothing lands on its own account page (always allowed), so nobody is ever
 * sent somewhere they'd be sent away from again.
 */
export const ADMIN_LANDING_CANDIDATES = [
  '/admin', '/admin/customers', '/admin/subscriptions', '/admin/payments', '/admin/revenue', '/admin/devices',
  '/admin/access-points', '/admin/microtik', '/admin/suggestions', '/admin/notifications', '/admin/announcements',
] as const

/** The account page for this kind of account (where a forced password change happens). */
export const accountPathFor = (subject: AccessSubject): string => (isStaffRole(subject.role) ? STAFF_ACCOUNT_PATH : CUSTOMER_ACCOUNT_PATH)

/** The landing page for an account: customers -> /customer; staff -> the first page they may open. */
export function homeFor(subject: AccessSubject): string {
  if (!isStaffRole(subject.role)) return '/customer'
  return ADMIN_LANDING_CANDIDATES.find((path) => canAccessAdminPath(path, subject)) ?? STAFF_ACCOUNT_PATH
}

/**
 * The sign-in page to send someone to when their session ends. Staff go back to the STAFF
 * door; everyone else (and anyone we know nothing about) to the customer door - we never
 * reveal where the staff door is to a visitor.
 */
export const loginPathForRole = (role?: UserRole | null): string => (isStaffRole(role) ? ADMIN_LOGIN_PATH : CUSTOMER_LOGIN_PATH)

/**
 * The route guard's decision, as a plain function so every case can be tested.
 * `subject` is the signed-in user, or null when nobody is signed in.
 * Returns the path to redirect to, or null to let the navigation through.
 */
export function resolveAuthRedirect(path: string, subject: AccessSubject | null): string | null {
  const isLoginPage = path === CUSTOMER_LOGIN_PATH || path === ADMIN_LOGIN_PATH

  if (subject === null) {
    // Signed out: the two sign-in pages are public; everything else (including every
    // /admin page) sends a visitor to the CUSTOMER sign-in, which says nothing about
    // where the staff one is.
    return isLoginPage ? null : CUSTOMER_LOGIN_PATH
  }

  // After a reset to the default password the account is held on its own account page until
  // it has chosen a new one (the server refuses everything else anyway).
  if (subject.must_change_password) {
    const account = accountPathFor(subject)
    return path === account ? null : account
  }

  const home = homeFor(subject)
  if (isLoginPage || path === '/') return home // already signed in: no point showing a sign-in page
  if (isUnder(path, '/admin')) {
    if (!isStaffRole(subject.role)) return '/customer'
    // A staff member poking at a page their account doesn't include goes to their landing page.
    return canAccessAdminPath(path, subject) ? null : home
  }
  if (isUnder(path, '/customer') && subject.role !== 'CUSTOMER') return home
  return null
}

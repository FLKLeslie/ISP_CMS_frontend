// Where people sign in, and who may be where.
//
// There are TWO sign-in pages, one per kind of account, at different URLs:
//
//   /login         customers          (the address printed on bills, shared with the public)
//   /staff/login   administrators     (not linked from anywhere a customer looks)
//
// The separation that matters is enforced by the SERVER, not by these pages: the
// customer sign-in endpoint refuses an administrator's correct credentials exactly like
// a wrong password, and the admin endpoint does the same to a customer's (backend
// accounts/serializers.py). These pages and redirects only send people to the right door.
//
// TO MOVE THE ADMIN SIGN-IN to another URL: change ADMIN_LOGIN_PATH below AND rename
// the page file app/pages/staff/login.vue to match (e.g. pages/ops/login.vue for
// '/ops/login'). Nothing else refers to the path.
import type { UserRole } from '~/types/api/auth'

export const CUSTOMER_LOGIN_PATH = '/login'
export const ADMIN_LOGIN_PATH = '/staff/login'

/** The landing page for each kind of account. */
export const homeForRole = (role: UserRole): string => (role === 'ADMIN' ? '/admin' : '/customer')

/**
 * The sign-in page to send someone to when their session ends. An administrator goes
 * back to the ADMIN door; everyone else (and anyone we know nothing about) to the
 * customer door - we never reveal where the admin door is to a visitor.
 */
export const loginPathForRole = (role?: UserRole | null): string => (role === 'ADMIN' ? ADMIN_LOGIN_PATH : CUSTOMER_LOGIN_PATH)

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)

/**
 * The route guard's decision, as a plain function so every case can be tested.
 * `role` is the signed-in user's role, or null when nobody is signed in.
 * Returns the path to redirect to, or null to let the navigation through.
 */
export function resolveAuthRedirect(path: string, role: UserRole | null): string | null {
  const isLoginPage = path === CUSTOMER_LOGIN_PATH || path === ADMIN_LOGIN_PATH

  if (role === null) {
    // Signed out: the two sign-in pages are public; everything else (including every
    // /admin page) sends a visitor to the CUSTOMER sign-in, which says nothing about
    // where the administrators' one is.
    return isLoginPage ? null : CUSTOMER_LOGIN_PATH
  }

  const home = homeForRole(role)
  if (isLoginPage || path === '/') return home // already signed in: no point showing a sign-in page
  if (isUnder(path, '/admin') && role !== 'ADMIN') return homeForRole('CUSTOMER')
  if (isUnder(path, '/customer') && role !== 'CUSTOMER') return homeForRole('ADMIN')
  return null
}

// Checks the access rules in app/utils/authPaths.ts - pure logic, no browser, no build.
// Run it after changing ANY permission rule, nav item or admin page:
//
//     npm run check:access          (needs Node 22.6+; uses its built-in TypeScript stripping)
//
// It exists because the Nuxt app has no test runner, and "who may open which page" is the
// kind of rule that breaks silently: a mistake here hides a page from someone who needs it,
// or shows one to someone who shouldn't see it - or, worst, redirects in a circle.
import assert from 'node:assert/strict'
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  ADMIN_LANDING_CANDIDATES, ADMIN_LOGIN_PATH, ADMIN_PAGE_RULES, CUSTOMER_ACCOUNT_PATH, CUSTOMER_LOGIN_PATH,
  STAFF_ACCOUNT_PATH, STAFF_ROLES, canAccessAdminPath, hasAnyPermission, hasPermission, homeFor, isStaffRole,
  isSuperAdmin, loginPathForRole, resolveAuthRedirect,
} from '../app/utils/authPaths.ts'
import { dependentsOf, sameSelection, toggled, withRequirements } from '../app/utils/permissionPicker.ts'

const here = dirname(fileURLToPath(import.meta.url))

// --- a copy of the backend's catalog and role templates (backend accounts/access.py) ----------
// Keep in step with it. If a page rule names a key that isn't here, the test below fails.
const GRANTABLE = [
  'dashboard.view', 'customers.view', 'customers.manage', 'subscriptions.view', 'subscriptions.manage', 'plans.manage',
  'payments.view', 'payments.record', 'revenue.view', 'devices.view', 'devices.manage', 'devices.credentials',
  'devices.console', 'access_points.view', 'access_points.manage', 'unregistered_devices.view',
  'unregistered_devices.manage', 'microtik.view', 'microtik.manage', 'suggestions.view', 'suggestions.manage',
  'announcements.manage', 'notifications.view', 'notifications.send', 'audit.view', 'staff.manage', 'staff.delete_subordinates',
]
const SUPERADMIN_ONLY = ['passwords.reset']
const TEMPLATES = {
  ADMIN: GRANTABLE.filter((k) => !['audit.view', 'staff.manage', 'staff.delete_subordinates'].includes(k)),
  TECHNICIAN: [
    'dashboard.view', 'customers.view', 'devices.view', 'devices.manage', 'devices.credentials', 'devices.console',
    'access_points.view', 'access_points.manage', 'unregistered_devices.view', 'unregistered_devices.manage',
    'microtik.view', 'microtik.manage', 'notifications.view',
  ],
  FINANCE: [
    'dashboard.view', 'customers.view', 'subscriptions.view', 'payments.view', 'payments.record', 'revenue.view',
    'notifications.view',
  ],
}
const who = (role, permissions = TEMPLATES[role] ?? [], extra = {}) => ({ role, permissions, must_change_password: false, ...extra })
const staff = (permissions, role = 'ADMIN') => who(role, permissions)
const ALL_ROLES = ['SUPERADMIN', 'ADMIN', 'TECHNICIAN', 'FINANCE']

// path -> which default roles may open it
const MATRIX = {
  '/admin': ALL_ROLES,
  '/admin/account': ALL_ROLES,
  '/admin/notifications': ALL_ROLES,
  '/admin/customers': ALL_ROLES, // read-only for the technician and the financial manager
  '/admin/customers/123': ALL_ROLES,
  '/admin/subscriptions': ['SUPERADMIN', 'ADMIN', 'FINANCE'],
  '/admin/suggestions': ['SUPERADMIN', 'ADMIN'],
  '/admin/announcements': ['SUPERADMIN', 'ADMIN'],
  '/admin/payments': ['SUPERADMIN', 'ADMIN', 'FINANCE'],
  '/admin/revenue': ['SUPERADMIN', 'ADMIN', 'FINANCE'],
  '/admin/devices': ['SUPERADMIN', 'ADMIN', 'TECHNICIAN'],
  '/admin/devices/map': ['SUPERADMIN', 'ADMIN', 'TECHNICIAN'],
  '/admin/devices/unregistered': ['SUPERADMIN', 'ADMIN', 'TECHNICIAN'],
  '/admin/devices/abc/configure': ['SUPERADMIN', 'ADMIN', 'TECHNICIAN'],
  '/admin/access-points': ['SUPERADMIN', 'ADMIN', 'TECHNICIAN'],
  '/admin/microtik': ['SUPERADMIN', 'ADMIN', 'TECHNICIAN'],
  '/admin/superadmin/staff': ['SUPERADMIN'],
  '/admin/superadmin/credentials': ['SUPERADMIN'],
  '/admin/superadmin/audit-log': ['SUPERADMIN'], // an administrator only if granted audit.view
}

test('the role templates open exactly the pages they should', () => {
  for (const [path, allowed] of Object.entries(MATRIX)) {
    for (const role of ALL_ROLES) {
      assert.equal(canAccessAdminPath(path, who(role)), allowed.includes(role), `${role} on ${path}`)
    }
  }
})

test('a super administrator opens everything whatever list the server sent', () => {
  for (const permissions of [[], null, undefined, ['revenue.view']]) {
    for (const path of Object.keys(MATRIX)) {
      assert.equal(canAccessAdminPath(path, { role: 'SUPERADMIN', permissions }), true, path)
    }
    assert.equal(hasPermission({ role: 'SUPERADMIN', permissions }, 'staff.manage'), true)
  }
})

test('customised permissions, not the role name, decide what opens', () => {
  const techPlusPayments = staff([...TEMPLATES.TECHNICIAN, 'payments.view'], 'TECHNICIAN')
  assert.equal(canAccessAdminPath('/admin/payments', techPlusPayments), true)
  assert.equal(canAccessAdminPath('/admin/revenue', techPlusPayments), false)

  const readOnlyAdmin = staff(['dashboard.view', 'customers.view'], 'ADMIN') // an "administrator" who can only look
  assert.equal(canAccessAdminPath('/admin', readOnlyAdmin), true)
  assert.equal(canAccessAdminPath('/admin/customers', readOnlyAdmin), true)
  for (const path of ['/admin/payments', '/admin/devices', '/admin/subscriptions', '/admin/superadmin/staff']) {
    assert.equal(canAccessAdminPath(path, readOnlyAdmin), false, path)
  }

  const auditor = staff(['dashboard.view', 'audit.view'], 'ADMIN')
  assert.equal(canAccessAdminPath('/admin/superadmin/audit-log', auditor), true)
  assert.equal(canAccessAdminPath('/admin/superadmin/staff', auditor), false)
  const subordinateManager = staff(['dashboard.view', 'staff.manage', 'staff.delete_subordinates'], 'ADMIN')
  assert.equal(canAccessAdminPath('/admin/superadmin/staff', subordinateManager), true)
})

test('the unregistered-devices page has its own permission, separate from the device list', () => {
  const devicesOnly = staff(['devices.view'])
  assert.equal(canAccessAdminPath('/admin/devices', devicesOnly), true)
  assert.equal(canAccessAdminPath('/admin/devices/unregistered', devicesOnly), false)
  const unregisteredOnly = staff(['unregistered_devices.view'])
  assert.equal(canAccessAdminPath('/admin/devices/unregistered', unregisteredOnly), true)
  assert.equal(canAccessAdminPath('/admin/devices', unregisteredOnly), false)
})

test('staff management is grantable only when explicitly assigned; password resets remain superadmin-only', () => {
  const sneaky = staff([...GRANTABLE, ...SUPERADMIN_ONLY], 'ADMIN')
  // Password-reset power is never sent to a non-superadmin; the server rejects it from lists.
  // staff.manage is grantable, but absent from the default ADMIN template.
  assert.equal(hasPermission(sneaky, 'staff.manage'), true)
  assert.equal(hasPermission(who('ADMIN'), 'staff.manage'), false)
  assert.equal(hasPermission(who('TECHNICIAN'), 'passwords.reset'), false)
})

test('customers and signed-out visitors may open no staff page', () => {
  const customer = { role: 'CUSTOMER', permissions: GRANTABLE }
  for (const path of Object.keys(MATRIX)) {
    assert.equal(canAccessAdminPath(path, customer), false, path)
    assert.equal(canAccessAdminPath(path, null), false, path)
    assert.equal(canAccessAdminPath(path, undefined), false, path)
    assert.equal(canAccessAdminPath(path, { role: 'ROOT', permissions: GRANTABLE }), false, path)
  }
  assert.equal(hasPermission(customer, 'customers.view'), false)
})

test('an account with no list (or a damaged one) has no staff permissions', () => {
  for (const permissions of [undefined, null, []]) {
    const subject = { role: 'ADMIN', permissions }
    assert.equal(canAccessAdminPath('/admin', subject), false)
    assert.equal(canAccessAdminPath('/admin/account', subject), true) // its own account page is always open
  }
})

test('query strings, hashes and look-alike paths do not change the decision', () => {
  assert.equal(canAccessAdminPath('/admin/customers?status=SUSPENDED', who('ADMIN')), true)
  assert.equal(canAccessAdminPath('/admin/payments#top', who('FINANCE')), true)
  assert.equal(canAccessAdminPath('/admin/devices-archive', who('TECHNICIAN')), false) // not under /admin/devices
  assert.equal(canAccessAdminPath('/admin/payments-old', who('FINANCE')), false)
  assert.equal(canAccessAdminPath('/admin/customersx', who('ADMIN')), false)
})

test('an unknown page is for super administrators only until someone opens it up deliberately', () => {
  assert.equal(canAccessAdminPath('/admin/brand-new-page', who('SUPERADMIN')), true)
  for (const role of ['ADMIN', 'TECHNICIAN', 'FINANCE']) assert.equal(canAccessAdminPath('/admin/brand-new-page', who(role)), false, role)
})

test('permission helpers', () => {
  assert.equal(hasPermission(who('TECHNICIAN'), 'devices.console'), true)
  assert.equal(hasPermission(who('TECHNICIAN'), 'payments.view'), false)
  assert.equal(hasAnyPermission(who('FINANCE'), ['devices.view', 'revenue.view']), true)
  assert.equal(hasAnyPermission(who('FINANCE'), ['devices.view']), false)
  assert.equal(hasAnyPermission(who('FINANCE'), []), false)
  assert.equal(hasPermission(null, 'x'), false)
  assert.equal(isSuperAdmin('SUPERADMIN'), true)
  assert.equal(isSuperAdmin('ADMIN'), false)
  assert.deepEqual([...STAFF_ROLES].sort(), [...ALL_ROLES].sort())
  assert.equal(isStaffRole('CUSTOMER'), false)
})

test('where each account lands', () => {
  for (const role of ALL_ROLES) assert.equal(homeFor(who(role)), '/admin', role)
  assert.equal(homeFor({ role: 'CUSTOMER' }), '/customer')
  // no dashboard permission -> the first area it CAN open
  assert.equal(homeFor(staff(['customers.view'])), '/admin/customers')
  assert.equal(homeFor(staff(['devices.view'])), '/admin/devices')
  assert.equal(homeFor(staff(['microtik.view'])), '/admin/microtik')
  assert.equal(homeFor(staff(['audit.view'])), STAFF_ACCOUNT_PATH) // nothing in the landing list -> its own account page
  assert.equal(homeFor(staff([])), STAFF_ACCOUNT_PATH)
  assert.equal(homeFor({ role: 'ADMIN', permissions: undefined }), STAFF_ACCOUNT_PATH)
})

test('sign-in doors', () => {
  for (const role of ALL_ROLES) assert.equal(loginPathForRole(role), ADMIN_LOGIN_PATH, role)
  for (const role of ['CUSTOMER', null, undefined]) assert.equal(loginPathForRole(role), CUSTOMER_LOGIN_PATH)
})

test('route guard: signed-out visitors', () => {
  assert.equal(resolveAuthRedirect(CUSTOMER_LOGIN_PATH, null), null)
  assert.equal(resolveAuthRedirect(ADMIN_LOGIN_PATH, null), null)
  for (const path of ['/', '/admin', '/admin/payments', '/customer', '/customer/plans']) {
    assert.equal(resolveAuthRedirect(path, null), CUSTOMER_LOGIN_PATH, path) // never reveals the staff door
  }
})

test('route guard: customers', () => {
  const c = { role: 'CUSTOMER', permissions: [], must_change_password: false }
  assert.equal(resolveAuthRedirect('/customer', c), null)
  assert.equal(resolveAuthRedirect('/customer/plans', c), null)
  assert.equal(resolveAuthRedirect('/', c), '/customer')
  assert.equal(resolveAuthRedirect(CUSTOMER_LOGIN_PATH, c), '/customer')
  assert.equal(resolveAuthRedirect(ADMIN_LOGIN_PATH, c), '/customer')
  for (const path of Object.keys(MATRIX)) assert.equal(resolveAuthRedirect(path, c), '/customer', path)
})

test('route guard: staff are sent to their landing page from pages they may not open', () => {
  for (const role of ALL_ROLES) {
    const s = who(role)
    assert.equal(resolveAuthRedirect('/', s), '/admin', role)
    assert.equal(resolveAuthRedirect(ADMIN_LOGIN_PATH, s), '/admin', role)
    assert.equal(resolveAuthRedirect(CUSTOMER_LOGIN_PATH, s), '/admin', role)
    assert.equal(resolveAuthRedirect('/customer', s), '/admin', role) // staff don't belong in the customer area
    assert.equal(resolveAuthRedirect('/customer/plans', s), '/admin', role)
    for (const [path, allowed] of Object.entries(MATRIX)) {
      assert.equal(resolveAuthRedirect(path, s), allowed.includes(role) ? null : '/admin', `${role} -> ${path}`)
    }
  }
  assert.equal(resolveAuthRedirect('/something-else', who('ADMIN')), null)
  assert.equal(resolveAuthRedirect('/administrator', who('TECHNICIAN')), null) // not under /admin
  // no dashboard permission: bounced to the first page it can open instead
  assert.equal(resolveAuthRedirect('/admin', staff(['customers.view'])), '/admin/customers')
})

test('forced password change: held on the account page until a new password is chosen', () => {
  const customer = { role: 'CUSTOMER', permissions: [], must_change_password: true }
  assert.equal(resolveAuthRedirect(CUSTOMER_ACCOUNT_PATH, customer), null)
  for (const path of ['/customer', '/customer/plans', '/', CUSTOMER_LOGIN_PATH, ADMIN_LOGIN_PATH, '/admin']) {
    assert.equal(resolveAuthRedirect(path, customer), CUSTOMER_ACCOUNT_PATH, path)
  }
  for (const role of ALL_ROLES) {
    const s = who(role, undefined, { must_change_password: true })
    assert.equal(resolveAuthRedirect(STAFF_ACCOUNT_PATH, s), null, role)
    for (const path of ['/admin', '/admin/customers', '/admin/devices', '/', ADMIN_LOGIN_PATH, '/customer']) {
      assert.equal(resolveAuthRedirect(path, s), STAFF_ACCOUNT_PATH, `${role} ${path}`)
    }
  }
  // ...and the moment the flag clears, normal rules apply again
  assert.equal(resolveAuthRedirect('/admin/customers', who('ADMIN')), null)
})

// --- the loop-proofing property ----------------------------------------------------------
// With per-account permissions, ANY subset of the catalog is a possible account. Whatever the
// subset and whatever page it asks for, following a redirect must always arrive somewhere that
// does not redirect again - otherwise the browser would bounce forever.
test('no permission set can ever cause a redirect loop', () => {
  let seed = 20261102
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
  const paths = [
    ...Object.keys(MATRIX), '/', '/customer', '/customer/plans', '/customer/account', CUSTOMER_LOGIN_PATH, ADMIN_LOGIN_PATH,
    '/admin/some/unknown/page', '/administrator', '/random',
  ]
  const universe = [...GRANTABLE, ...SUPERADMIN_ONLY]
  for (let i = 0; i < 600; i++) {
    const chance = rand()
    const permissions = universe.filter(() => rand() < chance)
    for (const role of [...ALL_ROLES, 'CUSTOMER']) {
      for (const must of [false, true]) {
        const subject = { role, permissions, must_change_password: must }
        for (const path of paths) {
          const target = resolveAuthRedirect(path, subject)
          if (target === null) continue
          assert.equal(
            resolveAuthRedirect(target, subject), null,
            `loop: ${role} must=${must} perms=${permissions.length} ${path} -> ${target} -> ${resolveAuthRedirect(target, subject)}`,
          )
        }
      }
    }
  }
})

test('the landing page an account is sent to is always one it may open', () => {
  let seed = 7
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
  for (let i = 0; i < 400; i++) {
    const chance = rand()
    const subject = staff([...GRANTABLE, ...SUPERADMIN_ONLY].filter(() => rand() < chance), STAFF_ROLES[i % STAFF_ROLES.length])
    const home = homeFor(subject)
    assert.equal(canAccessAdminPath(home, subject), true, `${home} for ${subject.permissions.join(',')}`)
  }
})

// --- keep the rules honest ---------------------------------------------------------------
test('every permission a page rule asks for exists in the backend catalog', () => {
  const known = new Set([...GRANTABLE, ...SUPERADMIN_ONLY])
  for (const rule of ADMIN_PAGE_RULES) {
    const keys = rule.permission === null ? [] : typeof rule.permission === 'string' ? [rule.permission] : rule.permission
    for (const key of keys) assert.ok(known.has(key), `${rule.prefix} asks for unknown permission "${key}"`)
  }
  for (const key of ADMIN_LANDING_CANDIDATES) assert.ok(ADMIN_PAGE_RULES.some((r) => r.prefix === key), `landing ${key} has a rule`)
})

function pageRoutes(dir, base = '') {
  const routes = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) { routes.push(...pageRoutes(full, `${base}/${name}`)); continue }
    if (!name.endsWith('.vue')) continue
    const stem = name.slice(0, -4)
    routes.push(stem === 'index' ? (base || '/') : `${base}/${stem}`)
  }
  return routes
}

test('every page under pages/admin is covered by an explicit access rule', () => {
  const pagesDir = join(here, '..', 'app', 'pages', 'admin')
  const routes = pageRoutes(pagesDir, '/admin')
  assert.ok(routes.length >= 15, `expected to find the admin pages, found ${routes.length}`)
  for (const route of routes) {
    const sample = route.replace(/\[[^\]]+\]/g, 'x') // customers/[id] -> customers/x
    const covered = ADMIN_PAGE_RULES.some((rule) => (rule.exact ? sample === rule.prefix : (sample === rule.prefix || sample.startsWith(`${rule.prefix}/`))))
    assert.ok(covered, `${relative(join(here, '..'), pagesDir)}: page ${route} has no entry in ADMIN_PAGE_RULES (it would silently be super-administrators-only)`)
  }
})


// --- the permission picker ---------------------------------------------------------------
// The dependency data below is the backend's catalog (accounts/access.py), in catalog order.
const CATALOG = [
  { key: 'dashboard.view', label: '', description: '', group: '', requires: [] },
  { key: 'customers.view', label: '', description: '', group: '', requires: [] },
  { key: 'customers.manage', label: '', description: '', group: '', requires: ['customers.view'] },
  { key: 'subscriptions.view', label: '', description: '', group: '', requires: [] },
  { key: 'subscriptions.manage', label: '', description: '', group: '', requires: ['subscriptions.view', 'customers.view'] },
  { key: 'plans.manage', label: '', description: '', group: '', requires: ['subscriptions.view'] },
  { key: 'payments.view', label: '', description: '', group: '', requires: [] },
  { key: 'payments.record', label: '', description: '', group: '', requires: ['payments.view', 'customers.view', 'subscriptions.view'] },
  { key: 'revenue.view', label: '', description: '', group: '', requires: [] },
  { key: 'devices.view', label: '', description: '', group: '', requires: [] },
  { key: 'devices.manage', label: '', description: '', group: '', requires: ['devices.view', 'customers.view'] },
  { key: 'devices.credentials', label: '', description: '', group: '', requires: ['devices.view'] },
  { key: 'devices.console', label: '', description: '', group: '', requires: ['devices.view'] },
  { key: 'access_points.view', label: '', description: '', group: '', requires: [] },
  { key: 'access_points.manage', label: '', description: '', group: '', requires: ['access_points.view'] },
  { key: 'unregistered_devices.view', label: '', description: '', group: '', requires: [] },
  { key: 'unregistered_devices.manage', label: '', description: '', group: '', requires: ['unregistered_devices.view', 'customers.view'] },
  { key: 'microtik.view', label: '', description: '', group: '', requires: [] },
  { key: 'microtik.manage', label: '', description: '', group: '', requires: ['microtik.view', 'customers.view'] },
  { key: 'suggestions.view', label: '', description: '', group: '', requires: [] },
  { key: 'suggestions.manage', label: '', description: '', group: '', requires: ['suggestions.view'] },
  { key: 'announcements.manage', label: '', description: '', group: '', requires: [] },
  { key: 'notifications.view', label: '', description: '', group: '', requires: [] },
  { key: 'notifications.send', label: '', description: '', group: '', requires: ['notifications.view', 'customers.view'] },
  { key: 'audit.view', label: '', description: '', group: '', requires: [] },
  { key: 'staff.delete_subordinates', label: '', description: '', group: '', requires: [] },
]

test('ticking a permission also ticks what it needs', () => {
  assert.deepEqual(
    toggled([], 'payments.record', true, CATALOG),
    ['customers.view', 'subscriptions.view', 'payments.view', 'payments.record'],
  )
  assert.deepEqual(toggled(['devices.view'], 'devices.console', true, CATALOG), ['devices.view', 'devices.console'])
  assert.deepEqual(toggled([], 'revenue.view', true, CATALOG), ['revenue.view']) // needs nothing
})

test('unticking a permission also unticks what needs it', () => {
  const full = withRequirements(['payments.record'], CATALOG)
  // Removing payments.view takes payments.record with it, but keeps the customer and subscription views.
  assert.deepEqual(toggled(full, 'payments.view', false, CATALOG), ['customers.view', 'subscriptions.view'])
  // Removing customers.view takes everything that needs a customer list with it.
  const lots = withRequirements(['payments.record', 'devices.manage', 'microtik.manage', 'revenue.view'], CATALOG)
  const without = toggled(lots, 'customers.view', false, CATALOG)
  for (const gone of ['payments.record', 'devices.manage', 'microtik.manage']) assert.ok(!without.includes(gone), gone)
  for (const kept of ['revenue.view', 'payments.view', 'devices.view', 'microtik.view']) assert.ok(without.includes(kept), kept)
})

test('unticking something nothing depends on removes only it', () => {
  const sel = withRequirements(['devices.manage', 'devices.console'], CATALOG)
  const after = toggled(sel, 'devices.console', false, CATALOG)
  assert.ok(!after.includes('devices.console'))
  assert.ok(after.includes('devices.manage') && after.includes('devices.view'))
})

test('a selection can always be made whole, whatever is ticked (the picker can never produce a half-working account)', () => {
  let seed = 99
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
  const keys = CATALOG.map((p) => p.key)
  let selection = []
  for (let i = 0; i < 2000; i++) {
    const key = keys[Math.floor(rand() * keys.length)]
    selection = toggled(selection, key, rand() < 0.6, CATALOG)
    // closed under dependencies after EVERY step, and in catalog order
    assert.ok(sameSelection(selection, withRequirements(selection, CATALOG)), `step ${i} left a gap: ${selection}`)
    assert.deepEqual(selection, keys.filter((k) => selection.includes(k)))
  }
})

test('dependents are found through chains', () => {
  assert.deepEqual(dependentsOf('payments.view', CATALOG), ['payments.record'])
  assert.ok(dependentsOf('customers.view', CATALOG).includes('payments.record'))
  assert.deepEqual(dependentsOf('revenue.view', CATALOG), [])
})

test('the picker agrees with the role templates: every template is already whole', () => {
  for (const [role, template] of Object.entries(TEMPLATES)) {
    assert.ok(sameSelection(withRequirements(template, CATALOG), template), role)
  }
})

test('sameSelection ignores order but not content', () => {
  assert.equal(sameSelection(['a', 'b'], ['b', 'a']), true)
  assert.equal(sameSelection(['a', 'b'], ['a', 'c']), false)
  assert.equal(sameSelection(['a'], ['a', 'b']), false)
  assert.equal(sameSelection([], []), true)
})

# 2026-11-05 - Admin navigation, account detail visibility, and password UX

* Admin sidebar now groups Suggestions, Announcements, and Notifications under Communications, with permission-aware tabs between their existing pages.
* Super-administrator-only Customer Accounts, Staff Accounts, and Audit Log links are presented in a top-bar Admin Menu rather than occupying sidebar space.
* Customer account management shows the customer's non-secret account/profile, contact, location, and router information in an expandable account-details view. Password status remains masked; password-hash viewing was removed from the frontend.
* Password entry fields throughout the frontend use a reusable reveal/hide control. Passwords are hidden by default and automatically hide when the field is cleared.
* Password policy: customers may use passwords of at least 4 characters; staff must use at least 8 characters. No character-class composition is required.
* Responsive tabs and dropdown menus use overflow handling and consistent shell styling.

# 2026-11-04 - Super administrator, per-account permissions, audit trail, logging

* Roles: SUPERADMIN, TECHNICIAN and FINANCE added next to ADMIN and CUSTOMER.
  Migration `accounts/0002` (also promotes existing Django-superuser admins to SUPERADMIN),
  `manage.py promote_superadmin <email>`; `createsuperuser` now makes a super administrator.
* Every staff account holds a list of permissions (catalog in `accounts/access.py`), pre-filled from its
  role's template and editable by the super administrator. Every endpoint now checks a permission
  instead of the role. Accounts that were never customised follow their role's template, so existing
  administrators keep exactly the access they had.
* Super administrator screens/endpoints: Staff Accounts (with permission picker), Customer Accounts,
  Audit Log, plus My Account for all staff. Passwords can't be read back; the super administrator can
  view the hash or reset to `DEFAULT_RESET_PASSWORD` (default `0000`), which forces a password change.
* Audit trail: `common.AuditLog` records who/what/before-after/IP/browser/request id for every staff
  change (migration `common/0002`); request ids and structured logs (`LOG_LEVEL`, `LOG_FILE`).
* New env vars: `DEFAULT_RESET_PASSWORD`, `AUDIT_TRUSTED_PROXY_COUNT`, `LOG_LEVEL`, `LOG_FILE`,
  `LOG_FILE_MAX_BYTES`, `LOG_FILE_BACKUPS`.
* No change to the Node service or the internal API contract.
* Not run against a live Django/Nuxt build when written - see PROJECT_HANDOVER.txt KNOWN ISSUES.
* (Older notes below describe earlier changes and may be out of date; PROJECT_HANDOVER.txt is the
  maintained record.)

# MikroTik access control update

Copy `backend/` and `frontend/` over the matching project roots (paths are project-relative).

## Deploy steps
1. `python manage.py migrate`   (adds microtik 0003)
2. Optional env vars (defaults shown):
   - `MIKROTIK_OFFLINE_THRESHOLD_SECONDS=90`         how long a silent router's devices still count as online
   - `MIKROTIK_COMMAND_CONFIRM_TIMEOUT_SECONDS=120`  how long a block/connect may stay Pending before it is declared failed
   - `MIKROTIK_AUTO_ENFORCEMENT=False`               leave OFF until manual block/connect is proven (see below)
3. No change to the Node service.

## The bug in your log
The router sends `signature=..&allowed_macs=..&data=..`. The old parser took everything up to `&data=` as the
signature, so it became `<sig>&allowed_macs=...`, matched no router, and every report got 404 "Unknown or unapproved router".
`microtik/parsing.py` now finds the three fields independently.

## Behaviour
- Access state comes from the router's `allowed_macs`: on the list = Allowed, off it = Blocked.
- Block/Connect -> device becomes Pending. Each later report is compared with what the command was meant to do:
  match -> Blocked/Allowed and the command is Confirmed; still not matching after 120s -> Failed and the state reverts
  to what the router says. (A grace period is needed because the first report after a click can pre-date the router
  fetching the command.)
- Devices missing from a report go Offline, are never deleted, and keep their customer. They can still be blocked/connected.
- Buttons: unallocated -> Allocate; Allowed -> Block; Blocked -> Connect; Pending -> "Awaiting MikroTik…" (Retry after the
  timeout); allocated devices also get Reallocate. The Reallocate modal also offers Unallocate.
- The allocation list only shows customers with no router, searchable by name/email/phone.
- Reallocating/unallocating clears the previous customer's router MAC, otherwise the next report would hand the device back.

## Automatic enforcement is OFF
Purchase, admin-grant and expiry no longer touch the MikroTik unless `MIKROTIK_AUTO_ENFORCEMENT=True`.
Explicit admin actions (MikroTik page buttons, customer page buttons, "Block internet access", deactivating a subscription)
always work. Reason: with ingestion fixed, leases will now exist, so the nightly `expire_subscriptions` job would
otherwise start blocking real customers immediately.

## Tests
`python -m unittest microtik.test_parsing` (pure Python, 21 tests) and `python manage.py test microtik`.

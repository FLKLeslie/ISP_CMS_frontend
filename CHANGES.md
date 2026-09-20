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

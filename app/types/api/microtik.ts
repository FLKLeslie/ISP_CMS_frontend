export type MikroTikRouterStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface MikroTikRouter {
  id: string
  signature: string
  identity: string
  model: string
  firmware: string
  mac_address: string
  status: MikroTikRouterStatus
  // Nullable — a router can be approved before anyone's mapped it to a
  // physical Access Point record.
  access_point: string | null
  access_point_name: string | null
  approved_by: string | null
  approved_by_name: string | null
  approved_at: string | null
  last_seen_at: string | null
  // Whether the router has checked in recently. When false, none of its
  // devices can be trusted as online.
  is_reporting: boolean
  lease_count: number
  online_lease_count: number
  offline_lease_count: number
  // Client routers this MikroTik can see that aren't matched to any
  // customer yet — drives the "needs review" indicator.
  unallocated_lease_count: number
  created_at: string
  updated_at: string
}

// Mirrors the router's OWN whitelist (`allowed_macs`), which is the source
// of truth:
//   ALLOWED  on the router's allowed list — has internet
//   BLOCKED  not on it
//   PENDING  a block/connect was queued and the router hasn't reported back
//            in a way that confirms it yet (see `pending_action`)
//   UNKNOWN  fallback only — the router has never sent an allowed list, so
//            we genuinely can't tell. Not produced by a current router script.
export type MikroTikAccessState = 'ALLOWED' | 'BLOCKED' | 'PENDING' | 'UNKNOWN'

export interface MikroTikLease {
  id: string
  router: string
  router_signature: string
  router_identity: string
  mac_address: string
  ip_address: string | null
  hostname: string
  // null when this device hasn't been allocated to a customer yet.
  customer: string | null
  customer_name: string | null
  customer_email: string | null
  is_allocated: boolean
  access_state: MikroTikAccessState
  // Only set while access_state is PENDING: which command the router still
  // has to confirm, since when, and whether it's been waiting so long that
  // a retry is offered.
  pending_action: MikroTikCommandType | null
  pending_since: string | null
  pending_expired: boolean
  // Recency-aware: in the router's latest report AND that report is recent.
  // An offline device is still on record and still allocated.
  online: boolean
  first_seen: string
  // The last time the router actually reported this device.
  last_seen: string
}

// Counts behind the tab badges on the MikroTik page.
export interface MikroTikLeaseSummary {
  total: number
  online: number
  offline: number
  unallocated: number
  pending: number
}

// A customer with no router allocated yet — the allocation picker's shape.
export interface AllocatableCustomer {
  id: string
  name: string
  email: string
  phone_number: string
  city: string
  status: 'ACTIVE' | 'SUSPENDED'
}

export type MikroTikCommandType = 'block' | 'reconnect'
export type MikroTikCommandStatus = 'PENDING' | 'SENT' | 'CONFIRMED' | 'FAILED'

export interface MikroTikCommand {
  id: string
  router: string
  router_signature: string
  // The MikroTik's name - what an administrator recognises (the signature is
  // a 32-character secret). Blank if the router never reported one.
  router_identity: string
  mac_address: string
  command_type: MikroTikCommandType
  // SENT      Node accepted queuing it for the router's next poll — NOT yet
  //           proof the router applied it. Never phrase SENT as "done".
  // CONFIRMED a later router report shows the change took effect.
  // FAILED    couldn't be delivered, or the router never applied it in time.
  status: MikroTikCommandStatus
  customer: string | null
  customer_name: string | null
  triggered_by: string | null
  triggered_by_name: string | null
  error_message: string
  created_at: string
  updated_at: string
}


// Payload for POST /api/microtik/commands/send/ — send an "add to allowed
// list" (reconnect) or "block" command for a MAC address directly, to one
// APPROVED router or to all of them. Exactly one of router / allRouters.
export interface SendMikroTikCommandPayload {
  macAddress: string
  commandType: MikroTikCommandType
  router?: string
  allRouters?: boolean
}

// One result per router the send was attempted against. Either a normal
// command record (router_id added) or, when a previous command for that
// device on that router is still awaiting confirmation, a conflict entry —
// that router is skipped rather than failing the whole request.
export type SendMikroTikCommandResult =
  | (MikroTikCommand & { router_id: string })
  | { router_id: string; router_identity: string; conflict: true; detail: string }

export interface SendMikroTikCommandResponse {
  results: SendMikroTikCommandResult[]
}

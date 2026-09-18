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
  lease_count: number
  // Client routers this MikroTik can see that aren't matched to any
  // customer yet — drives the "needs review" indicator.
  unallocated_lease_count: number
  created_at: string
  updated_at: string
}

// What Django last successfully asked the MikroTik to enforce for this
// MAC — NOT a confirmed reading of the MikroTik's real firewall state
// (nothing in this system can confirm that; see MikroTikCommand below).
// UNKNOWN means we've never told this MikroTik anything about this MAC.
export type MikroTikAccessState = 'UNKNOWN' | 'ALLOWED' | 'BLOCKED'

export interface MikroTikLease {
  id: string
  router: string
  router_signature: string
  router_identity: string
  mac_address: string
  ip_address: string | null
  hostname: string
  // null when this client router hasn't been matched to a customer yet —
  // it then shows up in the admin's allocation review queue.
  customer: string | null
  customer_name: string | null
  is_allocated: boolean
  access_state: MikroTikAccessState
  first_seen: string
  last_seen: string
}

export type MikroTikCommandType = 'block' | 'reconnect'
export type MikroTikCommandStatus = 'PENDING' | 'SENT' | 'FAILED'

export interface MikroTikCommand {
  id: string
  router: string
  router_signature: string
  mac_address: string
  command_type: MikroTikCommandType
  // "SENT" only ever means Node accepted queuing this for the router's
  // next poll — Node's polling protocol has no acknowledgement path back
  // at all, so this can never mean "the router actually applied it".
  // Always present that distinction to an admin, never phrase SENT as
  // "done".
  status: MikroTikCommandStatus
  customer: string | null
  customer_name: string | null
  triggered_by: string | null
  triggered_by_name: string | null
  error_message: string
  created_at: string
  updated_at: string
}

export type MikroTikRouterStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface MikroTikRouter {
  id: string
  signature: string
  identity: string
  model: string
  firmware: string
  mac_address: string
  // Administrator-maintained details - never overwritten by the router's own
  // reports. `label` is shown instead of `identity` when set.
  label: string
  site: string
  notes: string
  // Stored from the model via the product catalog - '' for models outside it
  // (most MikroTiks), in which case the UI draws its router icon.
  icon_id: string
  product_name: string
  product_line: string
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
  // The speed limit this device was LAST TOLD to run at. uplink/downlink are both
  // null on the default: no limit has been signalled for it, so the MikroTik treats
  // it as any uncapped device. Whole kbps (see utils/speeds.ts); uplink = data
  // leaving the customer, downlink = data coming to them.
  // This is what Django SENT, not what the router reports - the router never
  // reports speed back, so a limit is "queued", never "confirmed".
  uplink_kbps: number | null
  downlink_kbps: number | null
  has_speed_limit: boolean
  limit_label: string // 'default (no limit)' or 'uplink 5 Mbps / downlink 10 Mbps'
  limit_source: 'MANUAL' | 'PLAN' | '' // who decided it; '' while there is no limit
  limit_plan_name: string // the plan, when limit_source is PLAN
  limit_set_at: string | null // when the limit (or its removal) was last sent
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

// set_limit / clear_limit change a device's speed only and leave its access alone.
export type MikroTikCommandType = 'block' | 'reconnect' | 'set_limit' | 'clear_limit'
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
  // What this command did to the device's speed: 'SET' (to uplink/downlink below),
  // 'CLEAR' (back to default) or '' (nothing). A reconnect caused by a plan
  // activation carries one too. `limit_label` is it in words ('' when none) and
  // `plan_name` is the plan that caused it, if any.
  limit_change: 'SET' | 'CLEAR' | ''
  uplink_kbps: number | null
  downlink_kbps: number | null
  limit_label: string
  plan_name: string
  // How many times the command has been handed to Node. A block/connect nobody
  // has confirmed is sent AGAIN (about every 30 seconds, up to 4 times in all)
  // before it is failed, so 2+ means it was retried. last_attempt_at is the latest.
  send_attempts: number
  last_attempt_at: string | null
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
  // Only for 'set_limit': the speed, in whole kbps. Required together.
  uplinkKbps?: number
  downlinkKbps?: number
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

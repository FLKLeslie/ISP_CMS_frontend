import type { User } from './auth'

export type PlanType = 'GENERAL' | 'SPECIFIC'
// Lightweight shape of a customer eligible for a SPECIFIC plan - just
// enough for the admin plan-details panel, not the full Customer object.
export interface EligibleCustomer { id: string; name: string; email: string }
export interface Plan {
  id: string; name: string; description: string
  // How long the plan lasts. `duration_minutes` is the real value (a plan can
  // last 30 minutes, 2 hours or 30 days); `duration_label` is it readable
  // ("1 hour 30 minutes"); `duration_days` is whole days only (0 under a day).
  duration_minutes: number; duration_label: string; duration_days: number
  price: string; is_active: boolean; plan_type: PlanType
  // The speed this plan gives, in whole kbps. BOTH null = the default: activating
  // the plan tells the MikroTik nothing about speed (and lifts a limit the router
  // already has). BOTH set = every router of a customer on this plan is capped at
  // these values when the plan is activated. Uplink = data leaving the customer
  // (upload), downlink = data coming to them (download). See utils/speeds.ts.
  uplink_kbps: number | null; downlink_kbps: number | null
  has_speed_limit: boolean
  // The speed in words: 'default (no limit)' or 'uplink 5 Mbps / downlink 10 Mbps'.
  speed_label: string
  // Only meaningful when plan_type is SPECIFIC - who the plan is limited
  // to. Read as full nested objects; write with eligible_customer_ids
  // (see PlanWritePayload) which takes a plain list of customer IDs.
  eligible_customers: EligibleCustomer[]
  is_deleted: boolean; deleted_at: string | null
  created_at: string; updated_at: string
}

export type CustomerStatus = 'ACTIVE' | 'SUSPENDED'
export type CustomerType = 'RESIDENTIAL' | 'BUSINESS'
export type CustomerSubscriptionState = 'ACTIVE' | 'BLOCKED' | 'EXPIRED' | 'NONE'
export interface Customer {
  id: string; user: User; address: string; city: string; country: string
  // Profile details kept for the ISP's own records.
  customer_type: CustomerType; company_name: string; alternate_phone: string; landmark: string
  // Internal administrator note. ONLY present in responses to an administrator -
  // the backend drops it for a customer reading their own profile.
  notes?: string
  // At-a-glance summary - only present on /api/customers/ responses (not when a
  // customer is nested inside a subscription/payment/device), hence optional.
  device_count?: number
  primary_device_model?: string | null
  primary_device_product_name?: string | null
  primary_device_icon_id?: string | null
  plan_name?: string | null
  subscription_status?: CustomerSubscriptionState
  subscription_ends_at?: string | null
  // true/false = whether any of their routers is reporting through a MikroTik;
  // null = no router allocated yet.
  router_online?: boolean | null
  // Router IP is separate from any Device's own ip_address - it's the
  // customer-site router, known independently of whether a device has
  // been registered yet.
  // The customer's own router (what a MikroTik sees connected to it) —
  // NOT their PowerBeam radio. router_mac_address is the key that matches
  // this customer to reported MikroTik leases; blank means no MikroTik
  // report can be attributed to them automatically yet.
  router_mac_address: string
  router_ip: string | null
  router_hostname: string
  registration_date: string; status: CustomerStatus
  is_deleted: boolean; deleted_at: string | null
  created_at: string; updated_at: string
}

// The status as it really is today — the API derives ACTIVE/EXPIRED from the
// end date, so a plan past its end date reads EXPIRED even if the nightly job
// hasn't flipped the stored value yet. 'CANCELLED' is stored for what is
// shown everywhere as "Blocked" (an administrator cut the customer's
// internet); unlike the others it can be resumed.
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Active', EXPIRED: 'Expired', CANCELLED: 'Blocked',
}
export interface Subscription {
  id: string; customer: Customer; plan: Plan
  // The EXACT moments it runs from and to (ISO 8601). `ends_at` is when the
  // customer is disconnected — not "sometime that day". Use these, not the
  // dates, for anything time-sensitive; a plan can last just minutes.
  starts_at: string; ends_at: string
  // Alias of ends_at (kept because existing code reads it).
  expires_at: string
  // The calendar dates of the two moments above - fine for lists and filters.
  start_date: string; end_date: string
  amount_paid: string; status: SubscriptionStatus
  // Whole calendar days left (0 for a plan measured in hours/minutes) and the
  // exact seconds left - use remaining_seconds for anything shown to a person.
  remaining_days: number; remaining_seconds: number
  is_active: boolean
  // Set only while blocked (status 'CANCELLED'): when it was blocked, how long
  // ago (whole days, and exact seconds to the minute) — what "add the blocked
  // time" gives back on resume.
  blocked_at: string | null; blocked_days: number; blocked_seconds: number
  // Set only when an administrator granted this subscription directly
  // (e.g. a cash payment taken in person) rather than it arising from a
  // normal customer purchase - see POST /api/subscriptions/grant/.
  granted_by: string | null; granted_by_name: string | null
  created_at: string; updated_at: string
}

// Only three methods exist: CASH (used for both a walk-in cash payment
// and an administrator granting a plan directly - the two are the same
// thing from an accounting perspective, so they're not tracked
// separately) plus the two mobile-money gateways. No bank transfer.
export type PaymentMethod = 'CASH' | 'MTN_MOMO' | 'ORANGE_MONEY'
export type PaymentStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED'
export interface Payment {
  id: string; subscription: Subscription; customer: Customer; amount: string
  payment_method: PaymentMethod; payment_reference: string; payment_date: string
  recorded_by: string | null; recorded_by_name: string | null; status: PaymentStatus
  created_at: string; updated_at: string
}
import type { User } from './auth'

export type PlanType = 'GENERAL' | 'SPECIFIC'
// Lightweight shape of a customer eligible for a SPECIFIC plan - just
// enough for the admin plan-details panel, not the full Customer object.
export interface EligibleCustomer { id: string; name: string; email: string }
export interface Plan {
  id: string; name: string; description: string; duration_days: number
  price: string; is_active: boolean; plan_type: PlanType
  // Only meaningful when plan_type is SPECIFIC - who the plan is limited
  // to. Read as full nested objects; write with eligible_customer_ids
  // (see PlanWritePayload) which takes a plain list of customer IDs.
  eligible_customers: EligibleCustomer[]
  is_deleted: boolean; deleted_at: string | null
  created_at: string; updated_at: string
}

export type CustomerStatus = 'ACTIVE' | 'SUSPENDED'
export interface Customer {
  id: string; user: User; address: string; city: string; country: string
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
  id: string; customer: Customer; plan: Plan; start_date: string; end_date: string
  // Precise end-of-day moment for end_date, in ISO 8601 - use this (not
  // end_date) for a live days/hours/minutes countdown.
  expires_at: string
  amount_paid: string; status: SubscriptionStatus; remaining_days: number
  is_active: boolean
  // Set only while blocked (status 'CANCELLED'): when it was blocked, and the
  // whole days since — exactly what "add the blocked time" gives back on resume.
  blocked_at: string | null; blocked_days: number
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
import type { Paginated } from '~/types/api/common'
import type { Plan, PlanType, Subscription } from '~/types/api/subscriptions'

export interface PlanWritePayload {
  name: string; description: string; duration_days: number; price: string
  is_active: boolean; plan_type: PlanType
  // Required (non-empty) when plan_type is SPECIFIC, must be omitted/empty
  // for GENERAL - enforced on the backend too (see plans/serializers.py).
  eligible_customer_ids?: string[]
}

export function usePlansApi() {
  function listPlans(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<Plan>>('/api/plans/', { params: { page_size: 50, ...params } })
  }
  function createPlan(payload: PlanWritePayload) {
    return apiFetch<Plan>('/api/plans/', { method: 'POST', body: payload })
  }
  function updatePlan(id: string, payload: Partial<PlanWritePayload>) {
    return apiFetch<Plan>(`/api/plans/${id}/`, { method: 'PATCH', body: payload })
  }
  function deletePlan(id: string) {
    return apiFetch<void>(`/api/plans/${id}/`, { method: 'DELETE' })
  }
  function deactivatePlan(id: string) {
    return apiFetch<Plan>(`/api/plans/${id}/deactivate/`, { method: 'POST' })
  }
  function restorePlan(id: string) {
    return apiFetch<Plan>(`/api/plans/${id}/restore/`, { method: 'POST' })
  }
  return { listPlans, createPlan, updatePlan, deletePlan, deactivatePlan, restorePlan }
}

export function useSubscriptionsApi() {
  function listSubscriptions(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<Subscription>>('/api/subscriptions/', { params })
  }
  function createSubscription(payload: { customer: string; plan: string; start_date?: string; amount_paid?: string; status?: string }) {
    return apiFetch<Subscription>('/api/subscriptions/', { method: 'POST', body: payload })
  }
  // POST /api/subscriptions/purchase/ (Customer only) - buy or "duplicate"
  // a plan via MTN MoMo or Orange Money only (no cash/bank online). With
  // no payment gateway configured yet, the backend refuses with a 503 and
  // a plain-language detail message ("contact an administrator for a
  // direct subscription") rather than creating anything - callers should
  // surface err.data?.detail as-is rather than assuming success.
  function purchasePlan(planId: string, paymentMethod: 'MTN_MOMO' | 'ORANGE_MONEY') {
    return apiFetch<Subscription>('/api/subscriptions/purchase/', { method: 'POST', body: { plan: planId, payment_method: paymentMethod } })
  }
  // POST /api/subscriptions/grant/ (Administrator only) - grants a plan
  // directly to a customer, e.g. cash paid in person. Creates the
  // Subscription AND a matching COMPLETED/CASH Payment in one call (an
  // admin grant is treated as the same thing as a cash payment - see
  // Payment.Method, there's no separate "direct" method), so it behaves
  // exactly like a normal purchase in the customer's history. `amount`
  // defaults to the plan's price and `start_date` to today when omitted.
  function grantSubscription(payload: { customer: string; plan: string; amount?: string; start_date?: string }) {
    return apiFetch<Subscription>('/api/subscriptions/grant/', { method: 'POST', body: payload })
  }
  // POST /api/subscriptions/{id}/deactivate/ (Administrator only) - BLOCKS
  // the subscription (status shows as Blocked), alerts the customer, and cuts
  // their device off via the MikroTik. Only an active subscription can be
  // blocked (400 otherwise). Reversible with resumeSubscription. Frontend
  // should confirm with the admin before calling this.
  function deactivateSubscription(id: string) {
    return apiFetch<Subscription>(`/api/subscriptions/${id}/deactivate/`, { method: 'POST' })
  }
  // POST /api/subscriptions/{id}/resume/ (Administrator only) - reopens a
  // blocked subscription and reconnects the customer. addBlockedTime true
  // adds the days it spent blocked to the end date; false allows it as it is.
  // If the plan's end date has already passed the result comes back EXPIRED
  // and nothing is reconnected - check the returned status.
  function resumeSubscription(id: string, addBlockedTime: boolean) {
    return apiFetch<Subscription>(`/api/subscriptions/${id}/resume/`, {
      method: 'POST', body: { add_blocked_time: addBlockedTime },
    })
  }
  return { listSubscriptions, createSubscription, purchasePlan, grantSubscription, deactivateSubscription, resumeSubscription }
}
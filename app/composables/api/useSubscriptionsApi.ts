import type { Paginated } from '~/types/api/common'
import type { Plan, Subscription } from '~/types/api/subscriptions'

export function usePlansApi() {
  function listPlans(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<Plan>>('/api/plans/', { params: { page_size: 50, ...params } })
  }
  function createPlan(payload: { name: string; description: string; duration_days: number; price: string; is_active: boolean }) {
    return apiFetch<Plan>('/api/plans/', { method: 'POST', body: payload })
  }
  function updatePlan(id: string, payload: Partial<Parameters<typeof createPlan>[0]>) {
    return apiFetch<Plan>(`/api/plans/${id}/`, { method: 'PATCH', body: payload })
  }
  return { listPlans, createPlan, updatePlan }
}

export function useSubscriptionsApi() {
  function listSubscriptions(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<Subscription>>('/api/subscriptions/', { params })
  }
  function createSubscription(payload: { customer: string; plan: string; start_date?: string; amount_paid?: string; status?: string }) {
    return apiFetch<Subscription>('/api/subscriptions/', { method: 'POST', body: payload })
  }
  // NOT YET ON THE BACKEND - customers can't POST /api/subscriptions/ today
  // (admin-only permission). Wired up so the UI is ready once a
  // customer-permitted purchase endpoint exists.
  function purchasePlan(planId: string, paymentMethod: string) {
    return apiFetch<Subscription>('/api/subscriptions/purchase/', { method: 'POST', body: { plan: planId, payment_method: paymentMethod } })
  }
  return { listSubscriptions, createSubscription, purchasePlan }
}

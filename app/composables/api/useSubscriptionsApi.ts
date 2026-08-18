import type { Paginated } from '~/types/api/common'
import type { Plan, Subscription } from '~/types/api/subscriptions'

export function usePlansApi() {
  function listPlans() {
    return apiFetch<Paginated<Plan>>('/api/plans/', { params: { page_size: 50 } })
  }

  return { listPlans }
}

export function useSubscriptionsApi() {
  function listSubscriptions(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<Subscription>>('/api/subscriptions/', { params })
  }

  /**
   * NOT YET AVAILABLE ON THE BACKEND.
   *
   * subscriptions/permissions.py's SubscriptionPermission only allows
   * Administrators to create a Subscription - POST /api/subscriptions/
   * returns 403 for a Customer today. Purchasing/renewing needs a new,
   * customer-permitted endpoint that creates the Payment + Subscription
   * together (e.g. POST /api/subscriptions/purchase/). This function is
   * wired up to call that endpoint so the UI is ready the moment it
   * exists - until then, calling it will 404/403 and the page shows a
   * clear "not available yet" state rather than a silent failure.
   */
  function purchasePlan(planId: string, paymentMethod: string) {
    return apiFetch<Subscription>('/api/subscriptions/purchase/', {
      method: 'POST',
      body: { plan: planId, payment_method: paymentMethod },
    })
  }

  return { listSubscriptions, purchasePlan }
}

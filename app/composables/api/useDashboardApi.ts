import type { CustomerDashboard } from '~/types/api/customer-domain'

export function useDashboardApi() {
  function fetchCustomerDashboard() {
    return apiFetch<CustomerDashboard>('/api/dashboard/customer/')
  }

  return { fetchCustomerDashboard }
}

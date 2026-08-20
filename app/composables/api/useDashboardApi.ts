import type { CustomerDashboard } from '~/types/api/customer-domain'
import type { AdminDashboard } from '~/types/api/admin-dashboard'
export function useDashboardApi() {
  function fetchCustomerDashboard() { return apiFetch<CustomerDashboard>('/api/dashboard/customer/') }
  function fetchAdminDashboard() { return apiFetch<AdminDashboard>('/api/dashboard/admin/') }
  return { fetchCustomerDashboard, fetchAdminDashboard }
}

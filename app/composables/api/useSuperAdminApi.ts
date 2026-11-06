// Super-administrator endpoints (backend accounts/superadmin_views.py). Every one of these
// answers 403 to anyone who is not a super administrator (the audit log: to anyone without the
// audit.view permission), whatever the UI shows.
import type { Paginated } from '~/types/api/common'
import type {
  AuditEntry, CustomerCredential, PasswordResetResult, PermissionCatalog, ResetConfirmation,
  StaffAccount, StaffCreatePayload, StaffUpdatePayload,
} from '~/types/api/superadmin'

export function useSuperAdminApi() {
  // --- permissions ---------------------------------------------------------------------
  function fetchPermissionCatalog() {
    return apiFetch<PermissionCatalog>('/api/auth/permissions/')
  }

  // --- staff accounts ------------------------------------------------------------------
  function listStaff(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<StaffAccount>>('/api/auth/staff/', { params })
  }
  function createStaff(payload: StaffCreatePayload) {
    return apiFetch<StaffAccount>('/api/auth/staff/', { method: 'POST', body: payload })
  }
  function updateStaff(uuid: string, payload: StaffUpdatePayload) {
    return apiFetch<StaffAccount>(`/api/auth/staff/${uuid}/`, { method: 'PATCH', body: payload })
  }
  function resetStaffPassword(uuid: string, payload: ResetConfirmation) {
    return apiFetch<PasswordResetResult>(`/api/auth/staff/${uuid}/reset-password/`, { method: 'POST', body: payload })
  }
  // --- customer accounts ---------------------------------------------------------------
  function listCustomerCredentials(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<CustomerCredential>>('/api/auth/customer-credentials/', { params })
  }
  function resetCustomerPassword(userUuid: string, payload: ResetConfirmation) {
    return apiFetch<PasswordResetResult>(`/api/auth/customer-credentials/${userUuid}/reset-password/`, { method: 'POST', body: payload })
  }
  // --- audit log -----------------------------------------------------------------------
  function listAuditLog(params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<AuditEntry>>('/api/auth/audit-logs/', { params })
  }

  return {
    fetchPermissionCatalog,
    listStaff, createStaff, updateStaff, resetStaffPassword,
    listCustomerCredentials, resetCustomerPassword,
    listAuditLog,
  }
}

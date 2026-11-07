// Staff-account endpoints (backend accounts/superadmin_views.py). Most operations are
// Superadmins manage all staff. An Administrator may manage only subordinate staff when
// staff.manage is explicitly granted; permanent deletion additionally needs staff.delete_subordinates.
import type { Paginated } from '~/types/api/common'
import type {
  AuditEntry, CustomerCredential, PasswordResetResult, PermissionCatalog, ResetConfirmation,
  StaffAccount, StaffCreatePayload, StaffUpdatePayload, StaffDeletePayload, MainSuperadminTransferPayload,
} from '~/types/api/superadmin'

export function useSuperAdminApi() {
  // --- permissions ---------------------------------------------------------------------
  function fetchPermissionCatalog() {
    return apiFetch<PermissionCatalog>('/api/auth/permissions/')
  }

  // --- staff accounts ------------------------------------------------------------------
  function listStaff(params: Record<string, string | number> = {}) {
    const authStore = useAuthStore()
    const path = authStore.user?.role === 'ADMIN' ? '/api/auth/staff/subordinates/' : '/api/auth/staff/'
    return apiFetch<Paginated<StaffAccount>>(path, { params })
  }
  function createStaff(payload: StaffCreatePayload) {
    return apiFetch<StaffAccount>('/api/auth/staff/', { method: 'POST', body: payload })
  }
  function updateStaff(uuid: string, payload: StaffUpdatePayload) {
    return apiFetch<StaffAccount>(`/api/auth/staff/${uuid}/`, { method: 'PATCH', body: payload })
  }
  function deleteStaff(uuid: string, payload: StaffDeletePayload) {
    return apiFetch<void>(`/api/auth/staff/${uuid}/delete/`, { method: 'DELETE', body: payload })
  }
  function transferMainSuperadmin(payload: MainSuperadminTransferPayload) {
    return apiFetch<StaffAccount>('/api/auth/main-superadmin/transfer/', { method: 'POST', body: payload })
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
    listStaff, createStaff, updateStaff, deleteStaff, transferMainSuperadmin, resetStaffPassword,
    listCustomerCredentials, resetCustomerPassword,
    listAuditLog,
  }
}

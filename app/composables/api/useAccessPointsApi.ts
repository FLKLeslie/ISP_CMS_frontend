// Wraps /api/access-points/ (devices/urls.py -> AccessPointViewSet).
// AccessPointPermission on the backend is Administrator-only for EVERY
// method, including GET/list — unlike devices, which customers may at
// least read. Only call this composable from pages under /admin/; a
// customer session will get a 403 on every method here, including list.
import type { Paginated } from '~/types/api/common'
import type { AccessPoint, AccessPointWritePayload } from '~/types/api/devices'

export function useAccessPointsApi() {
  // GET /api/access-points/ — filterable by status, site (icontains),
  // has_location; searchable by name/model/site/ip_address/mac_address.
  function listAccessPoints(params: Record<string, string | number | boolean> = {}) {
    return apiFetch<Paginated<AccessPoint>>('/api/access-points/', { params })
  }

  function getAccessPoint(id: string) {
    return apiFetch<AccessPoint>(`/api/access-points/${id}/`)
  }

  function createAccessPoint(payload: Partial<AccessPointWritePayload> & { name: string }) {
    return apiFetch<AccessPoint>('/api/access-points/', { method: 'POST', body: payload })
  }

  function updateAccessPoint(id: string, payload: Partial<AccessPointWritePayload>) {
    return apiFetch<AccessPoint>(`/api/access-points/${id}/`, { method: 'PATCH', body: payload })
  }

  function deleteAccessPoint(id: string) {
    return apiFetch<void>(`/api/access-points/${id}/`, { method: 'DELETE' })
  }

  // Convenience wrapper for the admin device-map page — same rationale as
  // useDevicesApi's listDevicesWithLocation: filter server-side rather
  // than fetching everything and discarding APs with no pin.
  function listAccessPointsWithLocation() {
    return apiFetch<Paginated<AccessPoint>>('/api/access-points/', {
      params: { has_location: true, page_size: 200 },
    })
  }

  return {
    listAccessPoints,
    getAccessPoint,
    createAccessPoint,
    updateAccessPoint,
    deleteAccessPoint,
    listAccessPointsWithLocation,
  }
}
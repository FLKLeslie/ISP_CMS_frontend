// Wraps /api/access-points/ (devices/urls.py -> AccessPointViewSet).
// AccessPointPermission on the backend is Administrator-only for EVERY
// method, including GET/list — unlike devices, which customers may at
// least read. Only call this composable from pages under /admin/; a
// customer session will get a 403 on every method here, including list.
import type { Paginated } from '~/types/api/common'
import type {
  AccessPoint, AccessPointWritePayload, DetectAccessPointIdentityResult, DeviceListItem,
} from '~/types/api/devices'

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

  // Which customer Devices sit behind this AP. Manual for now — an
  // administrator attaches/detaches them; a future mechanism may derive
  // this automatically, at which point these become a manual override.
  function listAccessPointDevices(id: string) {
    return apiFetch<DeviceListItem[]>(`/api/access-points/${id}/devices/`)
  }

  function attachDeviceToAccessPoint(id: string, deviceId: string) {
    return apiFetch<DeviceListItem>(`/api/access-points/${id}/attach-device/`, {
      method: 'POST', body: { device: deviceId },
    })
  }

  function detachDeviceFromAccessPoint(id: string, deviceId: string) {
    return apiFetch<DeviceListItem>(`/api/access-points/${id}/detach-device/`, {
      method: 'POST', body: { device: deviceId },
    })
  }

  // POST /api/access-points/{id}/scan/ — manually triggers what otherwise
  // happens automatically every couple of minutes in the background (see
  // devices.services.scan_stale_access_points_for_unknown_devices on the
  // backend): a live radio-neighborhood scan through this AP, flagging any
  // MAC it sees that isn't already in our database as an "unknown device"
  // over in Unregistered Devices (useUnregisteredDevicesApi). Useful to
  // check right now rather than waiting for the next automatic cycle.
  function scanAccessPoint(id: string) {
    return apiFetch<{ scanned: boolean; neighbors_seen: number; unknown_found: number }>(
      `/api/access-points/${id}/scan/`, { method: 'POST' },
    )
  }

  // POST /api/access-points/{id}/detect-identity/ - asks the AP what model it is
  // and stores it (replacing what was there). 502 if it can't be reached.
  function detectAccessPointIdentity(id: string) {
    return apiFetch<DetectAccessPointIdentityResult>(
      `/api/access-points/${id}/detect-identity/`, { method: 'POST' },
    )
  }

  return {
    detectAccessPointIdentity,
    listAccessPointDevices,
    attachDeviceToAccessPoint,
    detachDeviceFromAccessPoint,
    scanAccessPoint,
    listAccessPoints,
    getAccessPoint,
    createAccessPoint,
    updateAccessPoint,
    deleteAccessPoint,
    listAccessPointsWithLocation,
  }
}
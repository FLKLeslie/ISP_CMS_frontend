// Wraps every endpoint under `devices/urls.py` and `devices/views.py`
// EXCEPT the internal (Node-only) heartbeat/resolve/result endpoints under
// /api/internal/devices/ — the frontend never calls those directly, per the
// architecture rule that the frontend only ever talks to Django's public API.
//
// Permission note (DeviceOwnedPermission on the backend): Administrators
// get full CRUD on any device. Customers get read-only (GET) access, and
// ONLY for devices linked to their own customer profile — the backend
// filters listDevices()/getDevice() results to "own devices" automatically
// for a customer session, so no extra client-side filtering is needed.
import type { Paginated } from '~/types/api/common'
import type {
  DeviceCommand,
  DeviceConfiguration,
  DeviceDetail,
  DeviceListItem,
  DeviceMetric,
  DeviceWritePayload,
} from '~/types/api/devices'

export function useDevicesApi() {
  // GET /api/devices/ — paginated, filterable (status, customer,
  // access_point, model, online, last_seen_after/before, has_location,
  // search=, ordering=). Pass any of those straight through in `params`.
  function listDevices(params: Record<string, string | number | boolean> = {}) {
    return apiFetch<Paginated<DeviceListItem>>('/api/devices/', { params })
  }

  // GET /api/devices/{id}/ — full detail, nests customer/access_point/
  // configuration/current_status.
  function getDevice(id: string) {
    return apiFetch<DeviceDetail>(`/api/devices/${id}/`)
  }

  // POST /api/devices/ — only `customer` and `device_name` are required;
  // every other field may be left unset and filled in later.
  function createDevice(payload: DeviceWritePayload) {
    return apiFetch<DeviceDetail>('/api/devices/', { method: 'POST', body: payload })
  }

  // PATCH /api/devices/{id}/ — partial update, same payload shape.
  function updateDevice(id: string, payload: Partial<DeviceWritePayload>) {
    return apiFetch<DeviceDetail>(`/api/devices/${id}/`, { method: 'PATCH', body: payload })
  }

  function deleteDevice(id: string) {
    return apiFetch<void>(`/api/devices/${id}/`, { method: 'DELETE' })
  }

  // GET /api/devices/{id}/metrics/ — historical time-series samples for
  // the "Signal & traffic, last 24h" charts on the device detail page.
  // Supports the same DeviceMetricFilter params (timestamp_after/before,
  // link_state) plus standard pagination.
  function getDeviceMetrics(id: string, params: Record<string, string | number> = {}) {
    return apiFetch<Paginated<DeviceMetric>>(`/api/devices/${id}/metrics/`, { params })
  }

  // Convenience wrapper: fetch devices that DO have a pinned location, for
  // the admin device-map page. Filters server-side (has_location=true)
  // rather than pulling the full list and filtering client-side.
  function listDevicesWithLocation() {
    return apiFetch<Paginated<DeviceListItem>>('/api/devices/', {
      params: { has_location: true, page_size: 200 },
    })
  }

  return {
    listDevices,
    getDevice,
    createDevice,
    updateDevice,
    deleteDevice,
    getDeviceMetrics,
    listDevicesWithLocation,
  }
}

export function useDeviceConfigurationApi() {
  // GET/PUT/PATCH only — configuration rows are auto-created alongside
  // their Device server-side, never created/deleted through this endpoint.
  function getConfiguration(id: string) {
    return apiFetch<DeviceConfiguration>(`/api/device-configurations/${id}/`)
  }
  function updateConfiguration(id: string, payload: Partial<DeviceConfiguration>) {
    return apiFetch<DeviceConfiguration>(`/api/device-configurations/${id}/`, {
      method: 'PATCH',
      body: payload,
    })
  }
  // List is mainly useful for looking up a device's configuration id by
  // device UUID (?device=<uuid>), since DeviceDetail already nests the
  // configuration object directly for the common case.
  function listConfigurations(params: Record<string, string> = {}) {
    return apiFetch<Paginated<DeviceConfiguration>>('/api/device-configurations/', { params })
  }
  return { getConfiguration, updateConfiguration, listConfigurations }
}

export function useDeviceCommandsApi() {
  // GET /api/device-commands/ — admin-only command queue/history. Filter
  // by device, status, or command_type.
  function listCommands(params: Record<string, string> = {}) {
    return apiFetch<Paginated<DeviceCommand>>('/api/device-commands/', { params })
  }

  // POST /api/device-commands/ — creates the command AND synchronously
  // attempts delivery through Node (see DeviceCommandViewSet.perform_create
  // on the backend). The response reflects whatever status Node returned
  // (SENT/COMPLETED/FAILED) or stays PENDING if Node was unreachable —
  // always re-fetch/poll rather than assuming success from a 201 alone.
  function createCommand(payload: {
    device: string
    command_type: DeviceCommand['command_type']
    payload?: Record<string, unknown>
  }) {
    return apiFetch<DeviceCommand>('/api/device-commands/', { method: 'POST', body: payload })
  }

  return { listCommands, createCommand }
}
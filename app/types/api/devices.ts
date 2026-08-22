// Types for the `devices` Django app: Access Points, Devices, their 1-1
// Configuration/CurrentStatus companions, historical Metrics, and remote
// Commands. Field names/types are matched exactly against
// backend/devices/serializers.py and backend/devices/models.py — do not
// rename fields here without changing the backend serializer to match.
import type { Customer } from './subscriptions'

// ---------------------------------------------------------------------------
// Shared choice unions (mirror the TextChoices classes in devices/models.py)
// ---------------------------------------------------------------------------
export type AccessPointStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'UNKNOWN'
export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'FAULTY' | 'DECOMMISSIONED'
export type LinkState = 'UP' | 'DOWN' | 'UNKNOWN'
export type WirelessMode = 'AP' | 'STATION' | 'AP_PTP' | 'STATION_PTP' | ''
export type IPAssignment = 'DHCP' | 'STATIC' | ''
export type CommandType =
  | 'REBOOT' | 'SYNC_CONFIG' | 'UPDATE_CONFIG' | 'FIRMWARE_UPGRADE'
  | 'FACTORY_RESET' | 'DIAGNOSTIC' | 'CUSTOM'
export type CommandStatus = 'PENDING' | 'SENT' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

// ---------------------------------------------------------------------------
// Access Point
// ---------------------------------------------------------------------------
export interface AccessPoint {
  id: string
  name: string
  model: string
  ip_address: string | null
  mac_address: string | null
  site: string
  firmware_version: string
  status: AccessPointStatus
  last_seen: string | null
  description: string
  // Nullable on purpose — an AP may exist in the system before anyone has
  // pinned its physical location on the map. Admin fills these in whenever
  // convenient, never required at creation time.
  latitude: string | null
  longitude: string | null
  location_label: string
  created_at: string
  updated_at: string
}

// Payload shape for create/update — same fields as AccessPoint minus the
// server-generated ones (id/created_at/updated_at are read-only).
export type AccessPointWritePayload = Omit<AccessPoint, 'id' | 'created_at' | 'updated_at'>

// ---------------------------------------------------------------------------
// Device Configuration (1-1 with Device)
// ---------------------------------------------------------------------------
export interface DeviceConfiguration {
  id: string
  device: string
  device_alias: string
  ssid: string
  wireless_mode: WirelessMode
  frequency: string | null // MHz
  channel_width: string
  tx_power: string | null // dBm
  airmax_enabled: boolean | null
  ip_assignment: IPAssignment
  static_ip: string | null
  subnet_mask: string | null
  gateway: string | null
  primary_dns: string | null
  secondary_dns: string | null
  time_zone: string
  auto_reboot: boolean | null
  reboot_time: string | null // "HH:MM:SS"
  management_enabled: boolean | null
  last_synced: string | null
  updated_by: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Device Current Status (1-1 with Device, overwritten on every heartbeat)
// ---------------------------------------------------------------------------
export interface DeviceCurrentStatus {
  id: string
  device: string
  online: boolean | null
  link_state: LinkState | ''
  uptime_seconds: number | null
  cpu_identifier: string
  cpu_usage: string | null // %
  ram_usage: string | null // %
  ram_total: number | null // KB
  ram_free: number | null // KB
  tx_rate: string | null // Mbps
  rx_rate: string | null // Mbps
  tx_bytes: number | null
  rx_bytes: number | null
  tx_packets: number | null
  rx_packets: number | null
  tx_errors: number | null
  rx_errors: number | null
  tx_dropped: number | null
  rx_dropped: number | null
  frequency: string | null // MHz
  channel_width: string
  signal_strength: string | null // dBm
  noise_floor: string | null // dBm
  last_updated: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Device Metric (append-only historical sample — same shape as
// DeviceCurrentStatus minus the id/device-identity bookkeeping fields,
// plus its own `timestamp`)
// ---------------------------------------------------------------------------
export interface DeviceMetric {
  id: string
  device: string
  timestamp: string
  uptime_seconds: number | null
  cpu_usage: string | null
  ram_usage: string | null
  tx_rate: string | null
  rx_rate: string | null
  tx_bytes: number | null
  rx_bytes: number | null
  tx_packets: number | null
  rx_packets: number | null
  tx_errors: number | null
  rx_errors: number | null
  tx_dropped: number | null
  rx_dropped: number | null
  frequency: string | null
  channel_width: string
  link_state: LinkState | ''
  signal_strength: string | null
  noise_floor: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Device Command (remote-management queue)
// ---------------------------------------------------------------------------
export interface DeviceCommand {
  id: string
  device: string
  command_type: CommandType
  payload: Record<string, unknown>
  status: CommandStatus
  response: Record<string, unknown> | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  executed_at: string | null
}

// ---------------------------------------------------------------------------
// Device — list vs detail vs write shapes differ (see DeviceListSerializer /
// DeviceDetailSerializer / DeviceWriteSerializer in devices/serializers.py)
// ---------------------------------------------------------------------------

// Lightweight shape returned by GET /api/devices/ (list action)
export interface DeviceListItem {
  id: string
  customer: string
  customer_name: string
  access_point: string | null
  access_point_name: string | null
  device_name: string
  model: string
  status: DeviceStatus
  ip_address: string | null
  last_seen: string | null
  online: boolean | null
  latitude: string | null
  longitude: string | null
}

// Full shape returned by GET /api/devices/{id}/ (retrieve action) — nests
// the full Customer/AccessPoint/Configuration/CurrentStatus objects.
export interface DeviceDetail {
  id: string
  customer: Customer
  access_point: AccessPoint | null
  device_name: string
  network_device_id: string | null
  serial_number: string | null
  mac_address: string | null
  model: string
  hardware_version: string
  firmware_version: string
  protocol_version: string
  api_version: string
  ip_address: string | null
  installation_date: string | null
  status: DeviceStatus
  last_seen: string | null
  notes: string
  // Nullable — same rationale as AccessPoint above: an admin pins the
  // device's physical location whenever they get around to it, never a
  // required field at registration.
  latitude: string | null
  longitude: string | null
  location_label: string
  configuration: DeviceConfiguration | null
  current_status: DeviceCurrentStatus | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Unregistered Device Sighting — an unknown MAC pinged the Node service and
// didn't match any registered Device. One row per MAC, not per ping — see
// devices/models.py UnregisteredDeviceSighting docstring for why.
// ---------------------------------------------------------------------------
export type SightingStatus = 'PENDING' | 'REGISTERED' | 'DISCARDED'

export interface UnregisteredDeviceSighting {
  id: string
  mac_address: string
  first_seen: string
  last_seen: string
  sighting_count: number
  // Whatever metric fields Node happened to include on the most recent
  // unregistered ping (signal_strength, cpu_usage, etc.) — shape mirrors
  // DeviceCurrentStatus but is untyped here since it's genuinely
  // best-effort/partial, unlike the fields on a registered device.
  last_sample: Record<string, unknown>
  status: SightingStatus
  resolved_device: string | null
  resolved_device_name: string | null
  resolved_by: string | null
  resolved_by_name: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Aggregated metric bucket — GET /api/devices/{id}/metrics/summary/
// Pre-aggregated at the database level (see devices/metrics_aggregation.py
// on the backend): 24 hourly buckets for '24h', 42 four-hourly buckets
// for '7d'. This is NOT the raw per-10-second DeviceMetric shape.
// ---------------------------------------------------------------------------
export interface DeviceMetricBucket {
  bucket_start: string
  bucket_hours: 1 | 4
  avg_cpu_usage: number | null
  avg_ram_usage: number | null
  avg_rx_rate: number | null
  avg_tx_rate: number | null
  sum_rx_errors: number
  sum_tx_errors: number
  sum_rx_dropped: number
  sum_tx_dropped: number
  latest_uptime_seconds: number | null
  sample_count: number
  availability_percent: number
}

export interface DeviceMetricSummary {
  range: '24h' | '7d'
  buckets: DeviceMetricBucket[]
}

// Payload for POST/PUT/PATCH /api/devices/ — only `customer` and
// `device_name` are actually required server-side; everything else may be
// filled in later once the physical device starts communicating.
export interface DeviceWritePayload {
  customer: string
  device_name: string
  access_point?: string | null
  network_device_id?: string | null
  serial_number?: string | null
  mac_address?: string | null
  model?: string
  hardware_version?: string
  firmware_version?: string
  protocol_version?: string
  api_version?: string
  ip_address?: string | null
  installation_date?: string | null
  status?: DeviceStatus
  notes?: string
  latitude?: string | null
  longitude?: string | null
  location_label?: string
}
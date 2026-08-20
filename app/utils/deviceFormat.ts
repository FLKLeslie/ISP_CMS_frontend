export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (minutes || !parts.length) parts.push(`${minutes}m`)
  return parts.join(' ')
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = -1
  do {
    value /= 1024
    unitIndex++
  } while (value >= 1024 && unitIndex < units.length - 1)
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unitIndex]}`
}

// tx_rate/rx_rate arrive from the backend ALREADY converted to Mbps (see
// devices/models.py DeviceCurrentStatus.tx_rate help_text="Mbps" — Node is
// expected to convert before sending to Django). This function only
// adapts the DISPLAY unit (Mbps vs Kbps) for readability at small values;
// it does not re-derive the value from any other source unit.
export function formatRateMbps(mbps: string | number | null | undefined): string {
  if (mbps == null) return '—'
  const value = typeof mbps === 'string' ? parseFloat(mbps) : mbps
  if (Number.isNaN(value)) return '—'
  if (value < 1) return `${(value * 1000).toFixed(0)} Kbps`
  return `${value.toFixed(2)} Mbps`
}

// frequency arrives from the backend in MHz (InternalHeartbeatSerializer's
// `frequency` field). Displayed in GHz, which reads more naturally for
// wifi frequencies (e.g. "5.795 GHz" rather than "5795 MHz").
export function formatFrequencyGHz(mhz: string | number | null | undefined): string {
  if (mhz == null) return '—'
  const value = typeof mhz === 'string' ? parseFloat(mhz) : mhz
  if (Number.isNaN(value)) return '—'
  return `${(value / 1000).toFixed(3)} GHz`
}

export function formatChannelWidth(width: string | null | undefined): string {
  if (!width) return '—'
  // channel_width is stored as free text (Node may send "20", "20/40",
  // etc). Only append " MHz" when it's a bare number — don't mangle a
  // compound value like "20/40" by blindly appending a unit to it.
  return /^\d+(\.\d+)?$/.test(width) ? `${width} MHz` : width
}

export type DeviceLiveStatus = 'ONLINE' | 'OFFLINE' | 'CONNECTING'

// The backend has no explicit "Connecting" state — only a nullable
// `online` boolean. We treat "never reported yet" (online === null,
// meaning no heartbeat has arrived since this device's status row was
// created) as "Connecting", since that's the honest, most useful
// interpretation: the device exists in the system but hasn't established
// its first link yet.
export function deriveDeviceLiveStatus(online: boolean | null | undefined): DeviceLiveStatus {
  if (online === true) return 'ONLINE'
  if (online === false) return 'OFFLINE'
  return 'CONNECTING'
}

export type NetworkHealth = 'HEALTHY' | 'WARNING' | 'POOR'

// Heuristic, not a precise engineering formula — combines error/drop
// counts into one glanceable indicator per the "keep it compact, don't
// make many separate cards" design brief. When packet counts are
// available we use an error RATE (errors+drops as a fraction of total
// packets), which scales sensibly regardless of how long the device has
// been up; when packet counts aren't available yet, we fall back to
// coarse absolute thresholds. Treat these thresholds as a starting point
// to tune once real device traffic patterns are observed, not as a
// precisely-calibrated spec.
export function deriveNetworkHealth(input: {
  rxErrors: number | null | undefined
  txErrors: number | null | undefined
  rxDropped: number | null | undefined
  txDropped: number | null | undefined
  rxPackets?: number | null | undefined
  txPackets?: number | null | undefined
}): NetworkHealth {
  const issues = (input.rxErrors ?? 0) + (input.txErrors ?? 0) + (input.rxDropped ?? 0) + (input.txDropped ?? 0)
  if (issues === 0) return 'HEALTHY'

  const totalPackets = (input.rxPackets ?? 0) + (input.txPackets ?? 0)
  if (totalPackets > 0) {
    const rate = issues / totalPackets
    if (rate < 0.001) return 'HEALTHY'
    if (rate < 0.01) return 'WARNING'
    return 'POOR'
  }

  // No packet counts to normalize against — fall back to coarse absolute
  // thresholds, deliberately conservative since we can't judge these
  // relative to actual traffic volume.
  if (issues < 10) return 'WARNING'
  return 'POOR'
}
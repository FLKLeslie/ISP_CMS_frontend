// Internet speeds (uplink / downlink limits).
//
// Mirrors backend common/speeds.py. Speeds travel and are stored as WHOLE KILOBITS
// PER SECOND (kbps) and are shown in whichever unit reads best. `null` always means
// "default": no limit is signalled to the MikroTik at all.
//
// Direction is from the CUSTOMER's point of view: UPLINK is data leaving them
// (uploads), DOWNLINK is data coming to them (downloads).

export const MIN_SPEED_KBPS = 1
export const MAX_SPEED_KBPS = 10_000_000 // 10 Gbps - a guard against a typo, not a technical limit

// kbps in each unit the UI offers.
export const SPEED_UNIT_KBPS = { kbps: 1, Mbps: 1000, Gbps: 1_000_000 } as const
export type SpeedUnit = keyof typeof SPEED_UNIT_KBPS

/** One speed as people say it: '512 kbps', '5 Mbps', '1.5 Mbps', '1 Gbps'; null -> 'default'. */
export function formatSpeed(kbps: number | null | undefined): string {
  if (kbps == null) return 'default'
  if (kbps >= 1_000_000) return `${trimNumber(kbps / 1_000_000)} Gbps`
  if (kbps >= 1000) return `${trimNumber(kbps / 1000)} Mbps`
  return `${kbps} kbps`
}

/** A whole limit in one phrase: 'Up 5 Mbps / Down 10 Mbps', or 'Default' when neither is set. */
export function describeLimit(uplink: number | null | undefined, downlink: number | null | undefined): string {
  if (uplink == null || downlink == null) return 'Default'
  return `Up ${formatSpeed(uplink)} / Down ${formatSpeed(downlink)}`
}

/** The largest unit that shows a speed without a long decimal: 1500 -> 1.5 Mbps, 512 -> 512 kbps. */
export function splitSpeed(kbps: number | null): { amount: number | ''; unit: SpeedUnit } {
  if (kbps == null) return { amount: '', unit: 'Mbps' }
  if (kbps >= 1_000_000 && kbps % 1_000_000 === 0) return { amount: kbps / 1_000_000, unit: 'Gbps' }
  if (kbps >= 1000) return { amount: kbps / 1000, unit: 'Mbps' }
  return { amount: kbps, unit: 'kbps' }
}

/** What the user typed -> whole kbps, or null when empty / not a positive number. */
export function toKbps(amount: number | string, unit: SpeedUnit): number | null {
  if (amount === '' || amount == null) return null
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) return null
  const kbps = Math.round(value * SPEED_UNIT_KBPS[unit])
  return kbps >= MIN_SPEED_KBPS ? kbps : null
}

function trimNumber(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '')
}

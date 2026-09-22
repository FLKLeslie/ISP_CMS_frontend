export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
export function formatCurrency(amount: string | number, currency = 'XAF'): string {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(numeric)
}
export function formatRemainingDays(days: number): string {
  if (days <= 0) return 'Expired'
  if (days === 1) return '1 day remaining'
  return `${days} days remaining`
}
export function formatRelativeTime(value: string): string {
  const then = new Date(value).getTime()
  const diffSeconds = Math.round((Date.now() - then) / 1000)
  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.34524, 'week'], [12, 'month'], [Number.POSITIVE_INFINITY, 'year'],
  ]
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  let duration = diffSeconds
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) return rtf.format(-Math.round(duration), unit)
    duration /= amount
  }
  return formatDate(value)
}

// A length of time as people say it: "45 minutes", "2 hours 10 minutes",
// "3 days". Shows at most `maxParts` of the largest non-zero units. Mirrors the
// backend's common/durations.py so a label reads the same wherever it comes from.
export function formatDuration(seconds: number, maxParts = 2, roundUp = false): string {
  let total = Math.max(Math.floor(seconds), 0)
  if (roundUp) total = Math.ceil(total / 60) * 60
  if (total < 60) return 'less than a minute'
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const unit = (n: number, name: string) => `${n} ${name}${n === 1 ? '' : 's'}`
  return [days && unit(days, 'day'), hours && unit(hours, 'hour'), minutes && unit(minutes, 'minute')]
    .filter(Boolean).slice(0, maxParts).join(' ')
}

// Time left on a plan, from the exact seconds remaining (NOT whole days - a plan
// measured in hours or minutes has 0 days left the whole time it is running).
export function formatRemainingSeconds(seconds: number): string {
  if (seconds <= 0) return 'Expired'
  return `${formatDuration(seconds, 2, true)} left`
}

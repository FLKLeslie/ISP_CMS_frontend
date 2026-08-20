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

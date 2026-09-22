// Shapes for GET /api/revenue/overview/ and /api/revenue/series/ (payments/
// revenue.py). "Revenue" is the sum of COMPLETED payments by payment date -
// the same definition the dashboard uses.

export type RevenueGranularity = 'day' | 'month' | 'year'
export type RevenueMetric = 'revenue' | 'payments' | 'average'
export type RevenueGroupBy = 'none' | 'plan' | 'method'
export type RevenueCompare = 'none' | 'previous_period' | 'previous_year'

export interface RevenueSeriesParams {
  granularity: RevenueGranularity
  metric: RevenueMetric
  group_by: RevenueGroupBy
  compare: RevenueCompare
  // Both or neither (omit both for a sensible default range).
  start?: string
  end?: string
}

export interface RevenueSeries {
  granularity: RevenueGranularity
  metric: RevenueMetric
  group_by: RevenueGroupBy
  // The range actually plotted: whole periods, so it can be wider than asked.
  range: { start: string; end: string }
  buckets: string[]   // ISO first day of each period
  labels: string[]    // "Sep 2026" / "20 Sep 2026" / "2026"
  // One line/bar set per group (or a single one when not grouping). Zero-filled.
  series: { name: string; data: number[] }[]
  // The value across ALL groups per period - the overall trend regardless of grouping.
  overall: number[]
  total: number
  compare: null | {
    label: string
    labels: string[]
    data: number[]
    total: number
    // null when there's nothing to compare against (growth from zero is "new", not a percentage).
    change_pct: number | null
  }
}

export interface RevenueOverview {
  as_of: string
  this_year: { year: number; revenue: number; payments: number }
  last_year: { year: number; revenue: number; payments: number }
  year_to_date: number
  // Last year measured over the SAME stretch (1 Jan to today's date), so the
  // comparison is like-for-like rather than against a whole year.
  last_year_same_period: number
  year_to_date_change_pct: number | null
  this_month: { label: string; revenue: number; payments: number }
  last_month_same_period: number
  month_to_date_change_pct: number | null
  average_monthly: number
  best_month: { label: string; revenue: number } | null
  trend: 'up' | 'down' | 'flat' | 'unknown'
  monthly: { month: number; label: string; current: number; previous: number }[]
  yearly: { year: number; revenue: number; payments: number }[]
}

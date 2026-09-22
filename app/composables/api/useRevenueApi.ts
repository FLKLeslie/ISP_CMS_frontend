// Wraps /api/revenue/ (payments/revenue_urls.py). Administrator-only.
import type { RevenueOverview, RevenueSeries, RevenueSeriesParams } from '~/types/api/revenue'

export function useRevenueApi() {
  // GET /api/revenue/overview/ — headline numbers: this year vs last year (like
  // for like), this month vs last month, and the month-by-month table.
  function fetchRevenueOverview() {
    return apiFetch<RevenueOverview>('/api/revenue/overview/')
  }

  // GET /api/revenue/series/ — one configurable time series: choose the
  // granularity (day/month/year), the metric, how to split it (by plan or
  // payment method), a date range, and an optional comparison period. Rejects a
  // range with too many periods to plot (400) with a message saying so.
  function fetchRevenueSeries(params: RevenueSeriesParams) {
    const query: Record<string, string> = {
      granularity: params.granularity, metric: params.metric,
      group_by: params.group_by, compare: params.compare,
    }
    if (params.start && params.end) { query.start = params.start; query.end = params.end }
    return apiFetch<RevenueSeries>('/api/revenue/series/', { params: query })
  }

  return { fetchRevenueOverview, fetchRevenueSeries }
}

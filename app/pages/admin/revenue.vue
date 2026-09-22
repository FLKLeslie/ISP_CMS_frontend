<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import type {
  RevenueCompare, RevenueGranularity, RevenueGroupBy, RevenueMetric, RevenueSeriesParams,
} from '~/types/api/revenue'

definePageMeta({ layout: 'admin' })

// This page is deliberately small: the administrator picks what they want to
// see, and it shows exactly that - a chart, one line of summary, and (only if
// asked for) the numbers behind it. Nothing else.
const { fetchRevenueSeries } = useRevenueApi()

// --- What to look at -----------------------------------------------------------------
type Period = 'last30' | 'last12' | 'thisYear' | 'lastYear' | 'last5' | 'custom'
const periodOptions: { key: Period; label: string }[] = [
  { key: 'last30', label: 'Last 30 days' },
  { key: 'last12', label: 'Last 12 months' },
  { key: 'thisYear', label: 'This year' },
  { key: 'lastYear', label: 'Last year' },
  { key: 'last5', label: 'Last 5 years' },
  { key: 'custom', label: 'Custom range…' },
]

// Local-date helper: toISOString() converts to UTC and shifts the day in any
// timezone ahead of UTC, so build the string from local parts.
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Each period comes with the sensible way to slice it; the administrator can
// still change "Show by" afterwards.
function rangeFor(period: Exclude<Period, 'custom'>): { start: string; end: string; by: RevenueGranularity } {
  const today = new Date()
  const y = today.getFullYear()
  if (period === 'last30') { const from = new Date(today); from.setDate(from.getDate() - 29); return { start: isoDate(from), end: isoDate(today), by: 'day' } }
  if (period === 'last12') return { start: isoDate(new Date(y, today.getMonth() - 11, 1)), end: isoDate(today), by: 'month' }
  if (period === 'thisYear') return { start: `${y}-01-01`, end: isoDate(today), by: 'month' }
  if (period === 'lastYear') return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31`, by: 'month' }
  return { start: `${y - 4}-01-01`, end: isoDate(today), by: 'year' }
}

const period = ref<Period>('last12')
const initial = rangeFor('last12')
const start = ref(initial.start)
const end = ref(initial.end)
const granularity = ref<RevenueGranularity>(initial.by)
const metric = ref<RevenueMetric>('revenue')
const groupBy = ref<RevenueGroupBy>('none')
const compare = ref<RevenueCompare>('none')
const kind = ref<'line' | 'area' | 'bar' | 'stacked'>('bar')
const showNumbers = ref(false)

watch(period, (value) => {
  if (value === 'custom') return // keep whatever range is there and let them edit it
  const next = rangeFor(value)
  start.value = next.start
  end.value = next.end
  granularity.value = next.by
})

const params = computed<RevenueSeriesParams>(() => ({
  granularity: granularity.value, metric: metric.value, group_by: groupBy.value, compare: compare.value,
  start: start.value, end: end.value,
}))
const rangeError = computed(() => {
  if (!start.value || !end.value) return 'Choose both a start and an end date.'
  if (end.value < start.value) return "The end date can't be before the start date."
  return ''
})

const { data: series, pending, error, refresh } = await useAsyncData(
  'admin-revenue-series',
  () => (rangeError.value ? Promise.resolve(null) : fetchRevenueSeries(params.value)),
  { watch: [params] },
)
const errorMessage = computed(() => (error.value ? apiErrorMessage(error.value, "Couldn't load this chart. Please try again.") : ''))
const hasData = computed(() => !!series.value && series.value.overall.some((v) => v > 0))

const money = (v: number) => (metric.value === 'payments' ? String(Math.round(v)) : formatCurrency(v))
const metricLabel = computed(() => ({ revenue: 'Revenue', payments: 'Payments', average: 'Average payment' })[metric.value])

// --- The numbers behind the chart (hidden until asked for) -------------------
const tableRows = computed(() => {
  const s = series.value
  if (!s) return []
  return s.labels.map((label, i) => ({
    label,
    values: s.series.map((line) => line.data[i] ?? 0),
    overall: s.overall[i] ?? 0,
    compare: s.compare ? s.compare.data[i] ?? 0 : null,
  }))
})

function downloadCsv() {
  const s = series.value
  if (!s) return
  const header = ['Period', ...s.series.map((l) => l.name)]
  if (s.group_by !== 'none') header.push('All')
  if (s.compare) header.push(s.compare.label)
  const lines = [header, ...tableRows.value.map((r) => [
    r.label, ...r.values, ...(s.group_by !== 'none' ? [r.overall] : []), ...(s.compare ? [r.compare ?? 0] : []),
  ])]
  const csv = lines.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  link.download = `${metric.value}-by-${s.granularity}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

const field = 'w-full rounded-card border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent'
const seg = (active: boolean) => (active ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary')
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-2xl font-semibold text-text-primary">Revenue</h1>

    <!-- Choose what to see -->
    <div class="rounded-card border border-border bg-surface p-4">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div>
          <label class="mb-1 block text-xs font-medium text-text-secondary" for="rev-period">Period</label>
          <select id="rev-period" v-model="period" :class="field">
            <option v-for="p in periodOptions" :key="p.key" :value="p.key">{{ p.label }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text-secondary" for="rev-metric">Show</label>
          <select id="rev-metric" v-model="metric" :class="field">
            <option value="revenue">Revenue</option>
            <option value="payments">Number of payments</option>
            <option value="average">Average payment</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text-secondary" for="rev-group">Split by</label>
          <select id="rev-group" v-model="groupBy" :class="field">
            <option value="none">Nothing</option>
            <option value="plan">Plan</option>
            <option value="method">Payment method</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text-secondary" for="rev-compare">Compare with</label>
          <select id="rev-compare" v-model="compare" :class="field">
            <option value="none">Nothing</option>
            <option value="previous_period">Previous period</option>
            <option value="previous_year">Same period last year</option>
          </select>
        </div>
        <div class="col-span-2 lg:col-span-1">
          <span class="mb-1 block text-xs font-medium text-text-secondary">Per</span>
          <div class="flex rounded-card border border-border bg-background p-0.5">
            <button v-for="g in [{ k: 'day', l: 'Day' }, { k: 'month', l: 'Month' }, { k: 'year', l: 'Year' }]" :key="g.k" type="button"
              class="flex-1 rounded-[0.4rem] px-2 py-1.5 text-sm font-medium transition-colors" :class="seg(granularity === g.k)"
              @click="granularity = g.k as RevenueGranularity"
            >{{ g.l }}</button>
          </div>
        </div>
      </div>

      <div v-if="period === 'custom'" class="mt-3 grid max-w-md grid-cols-2 gap-3">
        <div>
          <label class="mb-1 block text-xs font-medium text-text-secondary" for="rev-start">From</label>
          <input id="rev-start" v-model="start" type="date" :class="field">
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text-secondary" for="rev-end">To</label>
          <input id="rev-end" v-model="end" type="date" :class="field">
        </div>
      </div>

      <div class="mt-3 flex flex-wrap rounded-card border border-border bg-background p-0.5 sm:inline-flex">
        <button v-for="c in [{ k: 'bar', l: 'Bars' }, { k: 'line', l: 'Line' }, { k: 'area', l: 'Area' }, { k: 'stacked', l: 'Stacked' }]" :key="c.k" type="button"
          class="flex-1 rounded-[0.4rem] px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none" :class="seg(kind === c.k)"
          @click="kind = c.k as typeof kind"
        >{{ c.l }}</button>
      </div>
    </div>

    <p v-if="rangeError" role="alert" class="rounded-card border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-text-primary">{{ rangeError }}</p>
    <p v-else-if="errorMessage" role="alert" class="rounded-card border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{{ errorMessage }}</p>

    <!-- What they chose -->
    <LoadingState v-else-if="pending && !series" :rows="4" />
    <div v-else-if="series" class="rounded-card border border-border bg-surface p-4">
      <div class="mb-2 flex flex-wrap items-center gap-x-5 gap-y-2">
        <p class="text-sm text-text-secondary">
          {{ metricLabel }}<template v-if="metric !== 'average'"> total</template>
          <span class="ml-1 text-lg font-semibold text-text-primary">{{ money(series.total) }}</span>
        </p>
        <p v-if="series.compare" class="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          {{ series.compare.label }}: {{ money(series.compare.total) }} <ChangeBadge :pct="series.compare.change_pct" />
        </p>
        <div v-if="hasData" class="ml-auto flex items-center gap-2">
          <button type="button" class="btn-secondary" @click="showNumbers = !showNumbers">{{ showNumbers ? 'Hide numbers' : 'Show numbers' }}</button>
          <button type="button" class="btn-secondary inline-flex items-center gap-1.5" @click="downloadCsv">
            <Download class="h-4 w-4" aria-hidden="true" />CSV
          </button>
        </div>
      </div>

      <EmptyState v-if="!hasData" title="Nothing in this period" description="Try a wider period or a different measure." />
      <template v-else>
        <RevenueChart :kind="kind" :labels="series.labels" :series="series.series" :compare="series.compare" :metric="metric" />

        <div v-if="showNumbers" class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[360px] text-sm">
            <thead>
              <tr class="border-b border-border text-left text-xs text-text-secondary">
                <th class="py-2 pr-3 font-medium">Period</th>
                <th v-for="line in series.series" :key="line.name" class="py-2 pr-3 text-right font-medium">{{ line.name }}</th>
                <th v-if="series.group_by !== 'none'" class="py-2 pr-3 text-right font-medium">All</th>
                <th v-if="series.compare" class="py-2 text-right font-medium">{{ series.compare.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in tableRows" :key="row.label" class="border-b border-border last:border-0">
                <td class="py-2 pr-3 text-text-primary">{{ row.label }}</td>
                <td v-for="(value, i) in row.values" :key="i" class="py-2 pr-3 text-right text-text-primary">{{ money(value) }}</td>
                <td v-if="series.group_by !== 'none'" class="py-2 pr-3 text-right font-medium text-text-primary">{{ money(row.overall) }}</td>
                <td v-if="series.compare" class="py-2 text-right text-text-secondary">{{ money(row.compare ?? 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

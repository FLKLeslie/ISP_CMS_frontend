<script setup lang="ts">
import type { RevenueMetric } from '~/types/api/revenue'

// A chart the administrator can flip between line / area / bar / stacked bar
// without the data changing. Follows LineChart.vue and DonutChart.vue's
// conventions (ClientOnly, theme via useTheme, same font) and uses the site's own
// colours, in both themes.
//
// Every variant is built as an ApexCharts "combo" (chart type 'line' with a type
// per series). That is what lets a comparison line sit ON TOP of bars — and, for
// stacked bars, stay a separate line rather than being stacked into the total.
const props = defineProps<{
  kind: 'line' | 'area' | 'bar' | 'stacked'
  labels: string[]
  series: { name: string; data: number[] }[]
  // Optional dashed comparison line (previous period / same period last year).
  compare?: { label: string; data: number[]; labels: string[] } | null
  metric: RevenueMetric
  height?: number
}>()

const { resolved } = useTheme()
const dark = computed(() => resolved.value === 'dark')

// Site palette (tokens.css): secondary, accent, warning, success, error, then
// neutrals for the long tail of a grouped chart. Dark values match [data-theme='dark'].
const palette = computed(() => dark.value
  ? ['#2DD4BF', '#38BDF8', '#F59E0B', '#22C55E', '#F87171', '#A78BFA', '#94A3B8', '#FB923C', '#64748B']
  : ['#0F766E', '#38BDF8', '#D97706', '#16A34A', '#DC2626', '#7C3AED', '#64748B', '#EA580C', '#94A3B8'])
const compareColor = computed(() => (dark.value ? '#94A3B8' : '#64748B'))
const axisColor = computed(() => (dark.value ? '#94A3B8' : '#64748B'))

const mainType = computed(() => (props.kind === 'line' ? 'line' : props.kind === 'area' ? 'area' : 'column'))

const chartSeries = computed(() => {
  const main = props.series.map((s) => ({ name: s.name, type: mainType.value, data: s.data }))
  if (props.compare) main.push({ name: props.compare.label, type: 'line', data: props.compare.data })
  return main
})

const colors = computed(() => {
  const base = props.series.map((_, i) => palette.value[i % palette.value.length]!)
  return props.compare ? [...base, compareColor.value] : base
})

function format(value: number): string {
  if (value == null || Number.isNaN(value)) return ''
  if (props.metric === 'payments') return String(Math.round(value))
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}
// Axis ticks get compact ("1.2M") so long amounts don't crush the plot area.
function tick(value: number): string {
  if (props.metric === 'payments') return String(Math.round(value))
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

const chartOptions = computed(() => {
  const comparing = !!props.compare
  const count = chartSeries.value.length
  return {
    chart: {
      type: 'line' as const,
      stacked: props.kind === 'stacked',
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: true, tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false } },
      zoom: { enabled: false },
      background: 'transparent',
    },
    colors: colors.value,
    stroke: {
      width: chartSeries.value.map((s) => (s.type === 'column' ? 0 : 2.5)),
      curve: 'smooth' as const,
      // The comparison line is dashed so it's never mistaken for real data.
      dashArray: chartSeries.value.map((_, i) => (comparing && i === count - 1 ? 6 : 0)),
    },
    fill: { type: chartSeries.value.map((s) => (s.type === 'area' ? 'gradient' : 'solid')), gradient: { opacityFrom: 0.35, opacityTo: 0.05 } },
    plotOptions: { bar: { columnWidth: '60%', borderRadius: 3 } },
    markers: { size: props.labels.length <= 24 ? 3 : 0 },
    xaxis: {
      categories: props.labels,
      labels: { style: { colors: axisColor.value }, rotate: -45, rotateAlways: false, hideOverlappingLabels: true },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: axisColor.value }, formatter: tick }, min: 0 },
    grid: { borderColor: dark.value ? '#243247' : '#E2E8F0', strokeDashArray: 3 },
    legend: { position: 'top' as const, labels: { colors: axisColor.value } },
    dataLabels: { enabled: false },
    tooltip: {
      theme: resolved.value,
      shared: true,
      intersect: false,
      y: { formatter: format },
    },
    noData: { text: 'No data for this selection', style: { color: axisColor.value } },
  }
})
</script>

<template>
  <ClientOnly>
    <apexchart type="line" :height="props.height ?? 340" :options="chartOptions" :series="chartSeries" />
    <template #fallback>
      <div class="h-[340px] animate-pulse rounded-card bg-text-secondary/10" role="status" aria-label="Loading chart" />
    </template>
  </ClientOnly>
</template>

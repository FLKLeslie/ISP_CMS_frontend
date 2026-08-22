<script setup lang="ts">
// Matches DonutChart.vue's conventions exactly (ClientOnly wrapper, theme
// hookup via useTheme, same fontFamily) so charts look consistent across
// the whole admin area regardless of which page they're on.
const props = defineProps<{
  // ApexCharts multi-series format: one entry per line on the chart.
  series: { name: string; data: number[] }[]
  categories: string[] // x-axis labels, one per data point
  colors: string[]
  height?: number
  unit?: string // appended to tooltip/axis values, e.g. "%" or "Mbps"
}>()

const { resolved } = useTheme()

const chartOptions = computed(() => ({
  chart: {
    type: 'line' as const,
    fontFamily: 'Inter, sans-serif',
    toolbar: { show: false },
    zoom: { enabled: false },
  },
  colors: props.colors,
  stroke: { width: 2, curve: 'smooth' as const },
  xaxis: {
    categories: props.categories,
    labels: {
      style: { colors: resolved.value === 'dark' ? '#94A3B8' : '#64748B' },
      rotate: 0,
      trim: false,
      hideOverlappingLabels: false,
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      style: { colors: resolved.value === 'dark' ? '#94A3B8' : '#64748B' },
      formatter: (value: number) => props.unit ? `${value}${props.unit}` : `${value}`,
    },
  },
  grid: {
    borderColor: resolved.value === 'dark' ? '#243247' : '#E2E8F0',
    strokeDashArray: 3,
  },
  legend: {
    position: 'top' as const,
    labels: { colors: resolved.value === 'dark' ? '#94A3B8' : '#64748B' },
  },
  tooltip: {
    theme: resolved.value,
    y: { formatter: (value: number) => props.unit ? `${value}${props.unit}` : `${value}` },
  },
  dataLabels: { enabled: false },
}))
</script>

<template>
  <ClientOnly>
    <apexchart
      type="line"
      :height="props.height ?? 260"
      :options="chartOptions"
      :series="props.series"
    />
  </ClientOnly>
</template> 
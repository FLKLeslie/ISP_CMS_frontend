<script setup lang="ts">
const props = defineProps<{ series: number[]; labels: string[]; colors: string[]; height?: number }>()
const { resolved } = useTheme()
const chartOptions = computed(() => ({
  chart: { type: 'donut' as const, fontFamily: 'Inter, sans-serif' },
  labels: props.labels, colors: props.colors,
  legend: { position: 'bottom' as const, labels: { colors: resolved.value === 'dark' ? '#94A3B8' : '#64748B' } },
  dataLabels: { enabled: false }, stroke: { width: 0 }, tooltip: { theme: resolved.value },
  plotOptions: { pie: { donut: { labels: { show: true, total: { show: true, color: resolved.value === 'dark' ? '#F1F5F9' : '#0F172A' } } } } },
}))
</script>
<template>
  <ClientOnly>
    <apexchart type="donut" :height="props.height ?? 260" :options="chartOptions" :series="props.series" />
  </ClientOnly>
</template>

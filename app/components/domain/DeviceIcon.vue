<script setup lang="ts">
// The picture for a device, access point or router.
//
// Pass the `icon_id` the API returns. It is the id of the product picture the
// backend stored for the device's model; the image is frontend/devices/<id>.png
// (see utils/deviceIcons.ts). When there is no id, no such image, or the image
// fails to load, a generic icon is drawn - so the spot is never blank.
import { Radio, Router } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  iconId?: string | null
  // Which generic icon to fall back to: a radio for Ubiquiti-style hardware, a
  // router for MikroTik routers.
  fallback?: 'radio' | 'router'
  // sm: table rows, md: cards, lg: detail-page headers
  size?: 'sm' | 'md' | 'lg'
  // Tooltip - usually the model / product name.
  title?: string
}>(), { iconId: null, fallback: 'radio', size: 'sm', title: '' })

const src = computed(() => (isDeviceIconFailed(props.iconId) ? null : deviceIconUrl(props.iconId)))
const glyph = computed(() => (props.fallback === 'router' ? Router : Radio))
const box = computed(() => ({ sm: 'h-9 w-9', md: 'h-12 w-12', lg: 'h-20 w-20' })[props.size])
const glyphSize = computed(() => ({ sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-9 w-9' })[props.size])
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-card border border-border bg-background text-text-secondary"
    :class="box" :title="props.title || undefined"
  >
    <img
      v-if="src" :src="src" :alt="props.title" loading="lazy" decoding="async"
      class="h-full w-full object-contain p-1" @error="markDeviceIconFailed(props.iconId as string)"
    >
    <component :is="glyph" v-else :class="glyphSize" aria-hidden="true" />
  </span>
</template>

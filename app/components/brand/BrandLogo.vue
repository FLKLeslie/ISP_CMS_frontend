<script setup lang="ts">
// The application's logo (from branding.config.ts), optionally with its name beside it.
//
//   <BrandLogo size="lg" />                      logo only
//   <BrandLogo size="sm" tile show-name />       logo on a white tile + the name
//
// If the logo file isn't there yet (or fails to load) a tile with the first letter
// of the application's name is drawn instead, so there is never a broken image.
//
// `tile` puts the logo on a light rounded tile (--color-logo-tile) - use it on dark
// or colored backgrounds (the sidebar), so a logo with dark or transparent areas is
// still readable.
const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
  tile?: boolean
  showName?: boolean
}>(), { size: 'md', tile: false, showName: false })

const brand = useBrand()

// Shared by every BrandLogo on the page: if the file is missing, find out once.
const logoFailed = useState('brand-logo-failed', () => false)
const showImage = computed(() => !!brand.logo && !logoFailed.value)

const initial = computed(() => brand.name.trim().charAt(0).toUpperCase() || '?')
const box = computed(() => ({ sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14', xl: 'h-20 w-20' })[props.size])
const nameSize = computed(() => ({ sm: 'text-base', md: 'text-lg', lg: 'text-xl', xl: 'text-2xl' })[props.size])
</script>

<template>
  <span class="inline-flex items-center gap-2.5">
    <span
      class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-card"
      :class="[box, props.tile && showImage ? 'bg-logo-tile p-1 shadow-sm' : '']"
    >
      <!-- With the name shown next to it the image is decorative; alone it carries the name. -->
      <img
        v-if="showImage" :src="brand.logo!" :alt="props.showName ? '' : `${brand.name} logo`"
        class="h-full w-full object-contain" decoding="async" @error="logoFailed = true"
      >
      <span v-else class="flex h-full w-full items-center justify-center rounded-card bg-secondary font-semibold text-white" aria-hidden="true">
        {{ initial }}
      </span>
    </span>
    <span v-if="props.showName" class="font-semibold tracking-tight" :class="nameSize">{{ brand.name }}</span>
  </span>
</template>

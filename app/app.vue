<script setup lang="ts">
// Every page title gets the application name appended ("Devices · AirFiber"); a page
// that sets no title is just the name. The name comes from branding.config.ts.
const brand = useBrand()
useHead({ titleTemplate: (title) => (title ? `${title} · ${brand.name}` : brand.name) })
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

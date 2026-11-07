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
      <NuxtPage :transition="{ name: 'page-soft', mode: 'out-in' }" />
    </NuxtLayout>
  </div>
</template>

<style>
.page-soft-enter-active,
.page-soft-leave-active { transition: opacity 150ms ease, transform 150ms ease; }
.page-soft-enter-from { opacity: 0; transform: translateY(4px); }
.page-soft-leave-to { opacity: 0; transform: translateY(-3px); }
@media (prefers-reduced-motion: reduce) {
  .page-soft-enter-active, .page-soft-leave-active { transition: none; }
}
</style>

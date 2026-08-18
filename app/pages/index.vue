<script setup lang="ts">
// The global auth middleware (middleware/auth.global.ts) always redirects
// away from '/' - to /login if unauthenticated, or to the user's own
// portal if authenticated. This page is only ever visible for the instant
// before that redirect fires.
definePageMeta({ layout: false })
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background">
    <p class="text-sm text-text-secondary">Loading…</p>
  </div>
</template>

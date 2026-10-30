<script setup lang="ts">
// The CUSTOMER sign-in - the address customers are given. It admits customer accounts
// only (the server refuses an administrator's credentials here as if they were wrong),
// and it deliberately says nothing about where administrators sign in.
definePageMeta({ layout: false })
useHead({ title: 'Sign in' })
</script>

<template>
  <AuthShell variant="customer" heading="Welcome back" subheading="Sign in to manage your internet service.">
    <LoginForm portal="customer" />
    <p class="mt-8 text-center text-sm text-text-secondary">Trouble signing in? Please contact your service provider.</p>
  </AuthShell>
</template>

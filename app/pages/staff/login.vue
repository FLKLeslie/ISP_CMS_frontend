<script setup lang="ts">
// The ADMINISTRATOR sign-in. A separate page at a separate address from the customers'
// one, and it signs in through a separate server endpoint that admits administrators
// only: a customer's correct e-mail and password are refused here exactly like a wrong
// password, and an administrator's are refused at the customer page.
//
// Nothing links here. It is kept out of search results (noindex) and - deliberately -
// out of robots.txt, which would publish the address. To move it, see utils/authPaths.ts.
definePageMeta({ layout: false })
useHead({
  title: 'Administrator sign in',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <AuthShell variant="admin" heading="Administrator sign in" subheading="Authorised staff only.">
    <LoginForm portal="admin" />
  </AuthShell>
</template>

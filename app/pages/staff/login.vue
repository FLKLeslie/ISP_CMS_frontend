<script setup lang="ts">
// The STAFF sign-in (super administrators, administrators, technicians, financial
// managers). A separate page at a separate address from the customers' one, and it signs
// in through a separate server endpoint that admits staff only: a customer's correct
// e-mail and password are refused here exactly like a wrong password, and a staff
// member's are refused at the customer page.
//
// Nothing links here. It is kept out of search results (noindex) and - deliberately -
// out of robots.txt, which would publish the address. To move it, see utils/authPaths.ts.
definePageMeta({ layout: false })
useHead({
  title: 'Staff sign in',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <AuthShell variant="admin" heading="Staff sign in" subheading="Authorised staff only.">
    <LoginForm portal="admin" />
  </AuthShell>
</template>

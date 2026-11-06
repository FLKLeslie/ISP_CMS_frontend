<script setup lang="ts">
// Shown at the top of a page when the signed-in account may look at an area but not change
// it. The buttons on large pages aren't each hidden - the server refuses any change this
// account isn't allowed to make - so this says up front why, instead of letting someone
// click around and meet a refusal.
//
//   <ReadOnlyNotice v-if="!can('devices.manage')" area="devices" />
const props = defineProps<{ area: string }>()
</script>
<template>
  <p role="note" class="rounded-card border border-border bg-surface px-4 py-2.5 text-sm text-text-secondary">
    You have view-only access to {{ props.area }}. Changes you try to make will be refused - ask a super administrator if you need more access.
  </p>
</template>

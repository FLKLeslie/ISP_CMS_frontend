<script setup lang="ts">
import type { MikroTikAccessState, MikroTikCommandType } from '~/types/api/microtik'

// One place that decides how an access state looks, so the MikroTik page and
// the customer page can never disagree about it.
const props = defineProps<{ state: MikroTikAccessState; pendingAction?: MikroTikCommandType | null }>()

const view = computed(() => {
  switch (props.state) {
    case 'ALLOWED': return { label: 'Allowed', tone: 'success' as const }
    case 'BLOCKED': return { label: 'Blocked', tone: 'error' as const }
    case 'PENDING': return {
      label: props.pendingAction === 'block' ? 'Pending · blocking'
        : props.pendingAction === 'reconnect' ? 'Pending · connecting' : 'Pending',
      tone: 'warning' as const,
    }
    default: return { label: 'Unknown', tone: 'neutral' as const }
  }
})
</script>

<template>
  <StatusBadge :label="view.label" :tone="view.tone" />
</template>

<script setup lang="ts">
import type { MikroTikLease } from '~/types/api/microtik'

// The action buttons for ONE device, decided purely by its state:
//
//   not allocated            -> Allocate
//   allocated + Allowed      -> Block        (+ Reallocate)
//   allocated + Blocked      -> Connect      (+ Reallocate)
//   allocated + Pending      -> "Awaiting MikroTik…", no block/connect until
//                               the router confirms (or, once it has waited
//                               too long, a Retry of the same action)
//   allocated + Unknown      -> both Block and Connect (state can't be inferred)
//
// It only emits intent; the parent owns confirmation dialogs and API calls.
const props = defineProps<{ lease: MikroTikLease; busy?: boolean }>()
const emit = defineEmits<{ allocate: []; reallocate: []; block: []; connect: [] }>()

const base = 'rounded-card border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'
const tones = {
  block: `${base} border-error/40 text-error hover:bg-error/10`,
  connect: `${base} border-success/40 text-success hover:bg-success/10`,
  allocate: `${base} border-secondary/40 text-secondary hover:bg-secondary/10`,
  neutral: `${base} border-border text-text-primary hover:bg-text-secondary/10`,
}

const state = computed(() => props.lease.access_state)
const waiting = computed(() => state.value === 'PENDING' && !props.lease.pending_expired)
const retryingBlock = computed(() => state.value === 'PENDING' && props.lease.pending_expired && props.lease.pending_action === 'block')
const retryingConnect = computed(() => state.value === 'PENDING' && props.lease.pending_expired && props.lease.pending_action === 'reconnect')
const canBlock = computed(() => state.value === 'ALLOWED' || state.value === 'UNKNOWN' || retryingBlock.value)
const canConnect = computed(() => state.value === 'BLOCKED' || state.value === 'UNKNOWN' || retryingConnect.value)
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button v-if="!lease.is_allocated" type="button" :disabled="busy" :class="tones.allocate" @click.stop="emit('allocate')">
      Allocate
    </button>
    <template v-else>
      <span v-if="waiting" class="text-xs text-text-secondary">Awaiting MikroTik…</span>
      <button v-if="canBlock" type="button" :disabled="busy" :class="tones.block" @click.stop="emit('block')">
        {{ retryingBlock ? 'Retry block' : 'Block' }}
      </button>
      <button v-if="canConnect" type="button" :disabled="busy" :class="tones.connect" @click.stop="emit('connect')">
        {{ retryingConnect ? 'Retry connect' : 'Connect' }}
      </button>
      <button type="button" :disabled="busy" :class="tones.neutral" @click.stop="emit('reallocate')">Reallocate</button>
    </template>
  </div>
</template>

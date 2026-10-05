<script setup lang="ts">
// One numbered command on the MikroTik Commands tab.
//
// Every command has the same shape so an administrator learns it once:
//   a number and a professional name, a one- or two-line SUMMARY that is always
//   visible, a "Read more" toggle for the full explanation (so nobody has to read
//   it unless the summary wasn't enough), and then the controls themselves.
//
//   <CommandSection :number="1" title="..." summary="...">
//     <template #details> ...the longer explanation... </template>
//     ...the controls...
//   </CommandSection>
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps<{ number: number; title: string; summary: string }>()

const open = ref(false)
// Unique per command so aria-controls points at the right panel.
const panelId = `command-${props.number}-details`
const headingId = `command-${props.number}-title`
</script>

<template>
  <section class="rounded-card border border-border bg-surface" :aria-labelledby="headingId">
    <header class="flex items-start gap-3 p-4 sm:p-5">
      <span
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-sm font-semibold text-secondary"
        aria-hidden="true"
      >{{ props.number }}</span>
      <div class="min-w-0 flex-1">
        <h2 :id="headingId" class="text-base font-semibold text-text-primary">{{ props.title }}</h2>
        <p class="mt-0.5 text-sm text-text-secondary">{{ props.summary }}</p>
        <button
          v-if="$slots.details" type="button"
          class="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          :aria-expanded="open" :aria-controls="panelId" @click="open = !open"
        >
          {{ open ? 'Show less' : 'Read more' }}
          <ChevronDown class="h-4 w-4 transition-transform" :class="{ 'rotate-180': open }" aria-hidden="true" />
        </button>
        <div v-if="$slots.details" v-show="open" :id="panelId" class="mt-3 space-y-2 rounded-card bg-background p-3 text-sm text-text-secondary">
          <slot name="details" />
        </div>
      </div>
    </header>
    <div class="border-t border-border p-4 sm:p-5"><slot /></div>
  </section>
</template>

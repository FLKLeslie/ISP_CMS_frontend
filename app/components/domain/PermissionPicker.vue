<script setup lang="ts">
// The checklist a super administrator uses to decide exactly what a staff member may do.
// It is pre-filled with the chosen role's template (the parent does that), and every box can
// be ticked or unticked - so an account gets only what the super administrator chose.
//
// Ticking a permission also ticks what it needs, and unticking one also unticks what needs it
// (utils/permissionPicker.ts), so the result is always a whole, working set. The server applies
// the same rule when saving, so this is a convenience while choosing, not the protection.
//
//   <PermissionPicker v-model="selected" :catalog="catalog" :disabled="saving" />
import type { PermissionCatalog } from '~/types/api/superadmin'

const props = defineProps<{ modelValue: string[]; catalog: PermissionCatalog; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const labelFor = (key: string) => props.catalog.permissions.find((p) => p.key === key)?.label ?? key
const grouped = computed(() =>
  props.catalog.groups
    .map((group) => ({ ...group, permissions: props.catalog.permissions.filter((p) => p.group === group.key) }))
    .filter((group) => group.permissions.length),
)
const isOn = (key: string) => props.modelValue.includes(key)
const countIn = (permissions: { key: string }[]) => permissions.filter((p) => isOn(p.key)).length

function toggle(key: string, event: Event) {
  const on = (event.target as HTMLInputElement).checked
  emit('update:modelValue', toggled(props.modelValue, key, on, props.catalog.permissions))
}
function setGroup(keys: string[], on: boolean) {
  let next = [...props.modelValue]
  for (const key of keys) next = toggled(next, key, on, props.catalog.permissions)
  emit('update:modelValue', next)
}
const selectAll = () => emit('update:modelValue', withRequirements(props.catalog.permissions.map((p) => p.key), props.catalog.permissions))
const clearAll = () => emit('update:modelValue', [])

// What would be switched on automatically / off along with a permission - shown as a hint.
const needsHint = (requires: string[]) => requires.map(labelFor).join(', ')
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-text-secondary" aria-live="polite">
        <strong class="text-text-primary">{{ props.modelValue.length }}</strong> of {{ props.catalog.permissions.length }} permissions selected
      </p>
      <div class="flex gap-2">
        <button type="button" :disabled="props.disabled" class="rounded-card border border-border px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-text-secondary/10 disabled:opacity-50" @click="selectAll">Select all</button>
        <button type="button" :disabled="props.disabled" class="rounded-card border border-border px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-text-secondary/10 disabled:opacity-50" @click="clearAll">Clear all</button>
      </div>
    </div>

    <fieldset v-for="group in grouped" :key="group.key" :disabled="props.disabled" class="rounded-card border border-border">
      <legend class="sr-only">{{ group.label }}</legend>
      <div class="flex items-center justify-between gap-2 border-b border-border bg-text-secondary/5 px-3 py-2">
        <h3 class="text-sm font-semibold text-text-primary">
          {{ group.label }}
          <span class="ml-1 text-xs font-normal text-text-secondary">{{ countIn(group.permissions) }}/{{ group.permissions.length }}</span>
        </h3>
        <div class="flex gap-3 text-xs">
          <button type="button" class="text-accent hover:underline disabled:opacity-50" :disabled="props.disabled" @click="setGroup(group.permissions.map((p) => p.key), true)">All</button>
          <button type="button" class="text-text-secondary hover:underline disabled:opacity-50" :disabled="props.disabled" @click="setGroup(group.permissions.map((p) => p.key), false)">None</button>
        </div>
      </div>
      <ul class="divide-y divide-border">
        <li v-for="permission in group.permissions" :key="permission.key" class="px-3 py-2.5">
          <label class="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox" class="mt-1 rounded border-border" :checked="isOn(permission.key)"
              :aria-describedby="`perm-${permission.key}`" @change="toggle(permission.key, $event)"
            >
            <span class="min-w-0">
              <span class="block text-sm font-medium text-text-primary">{{ permission.label }}</span>
              <span :id="`perm-${permission.key}`" class="block text-xs text-text-secondary">
                {{ permission.description }}
                <span v-if="permission.requires.length" class="block italic">Also needs: {{ needsHint(permission.requires) }}.</span>
              </span>
            </span>
          </label>
        </li>
      </ul>
    </fieldset>
  </div>
</template>

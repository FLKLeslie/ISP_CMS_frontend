<script setup lang="ts">
export interface DataTableColumn { key: string; label: string }
const props = defineProps<{ columns: DataTableColumn[]; rows: Record<string, any>[]; rowKey: string }>()
const emit = defineEmits<{ 'row-click': [row: Record<string, any>] }>()
</script>
<template>
  <div class="overflow-x-auto rounded-card border border-border bg-surface">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-border text-xs uppercase text-text-secondary">
        <tr><th v-for="column in props.columns" :key="column.key" class="whitespace-nowrap px-4 py-3 font-medium">{{ column.label }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in props.rows" :key="row[props.rowKey]" class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-text-secondary/5" @click="emit('row-click', row)">
          <td v-for="column in props.columns" :key="column.key" class="whitespace-nowrap px-4 py-3 text-text-primary">
            <slot :name="`cell-${column.key}`" :row="row">{{ row[column.key] }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

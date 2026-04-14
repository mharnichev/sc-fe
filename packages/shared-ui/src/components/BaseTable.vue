<script setup lang="ts">
defineProps<{
  columns: Array<{ key: string; label: string }>
  rows: Record<string, unknown>[]
}>()
</script>

<template>
  <div class="overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white shadow-sm">
    <table class="min-w-full divide-y divide-stone-200 text-sm">
      <thead class="bg-stone-50">
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            class="px-4 py-3 text-left font-medium text-stone-500"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-stone-100">
        <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
          <td v-for="column in columns" :key="column.key" class="px-4 py-3 text-stone-800">
            {{ row[column.key] }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { SendLog } from '~/types/messaging'

defineProps<{ logs: SendLog[], pending?: boolean }>()
const emit = defineEmits<{ retry: [log: SendLog] }>()
</script>

<template>
  <div class="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
    <div v-if="pending" class="p-6 text-sm text-slate-500">Завантажуємо журнал відправок...</div>
    <table v-else-if="logs.length" class="min-w-full divide-y divide-slate-200 text-sm">
      <thead class="bg-slate-50">
        <tr>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Клієнт</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Телефон</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Telegram</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Час</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Причина</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Дія</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="log in logs" :key="log.id">
          <td data-label="Клієнт" class="px-4 py-3 font-medium text-slate-900">{{ log.client_name }}</td>
          <td data-label="Телефон" class="px-4 py-3 text-slate-700">{{ log.phone }}</td>
          <td data-label="Telegram" class="px-4 py-3">
            <span class="rounded-full px-2 py-1 text-xs font-medium" :class="log.telegram_status === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'">
              {{ log.telegram_status }}
            </span>
          </td>
          <td data-label="Час" class="px-4 py-3 text-slate-700">{{ log.sent_at ? new Date(log.sent_at).toLocaleString('uk-UA') : '—' }}</td>
          <td data-label="Причина" class="px-4 py-3 text-slate-700">{{ log.failure_reason || '—' }}</td>
          <td data-label="Дії" class="px-4 py-3">
            <BaseButton
              type="button"
              class="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40"
              :disabled="log.telegram_status !== 'failed'"
              @click="emit('retry', log)"
            >
              Повторити
            </BaseButton>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="p-6 text-sm text-slate-500">Журнал відправок ще порожній.</p>
  </div>
</template>

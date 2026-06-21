<script setup lang="ts">
import type { RecipientPreview } from '~/types/messaging'

defineProps<{
  recipients: RecipientPreview[]
  pending?: boolean
  error?: string | null
  emptyLabel?: string
}>()
</script>

<template>
  <div class="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white">
    <div v-if="pending" class="p-6 text-sm text-slate-500">Завантажуємо отримувачів...</div>
    <div v-else-if="error" class="p-6 text-sm text-rose-600">{{ error }}</div>
    <table v-else-if="recipients.length" class="min-w-full divide-y divide-slate-200 text-sm">
      <thead class="bg-slate-50">
        <tr>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Клієнт</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Телефон</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Telegram</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Згода</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Мова</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="recipient in recipients" :key="recipient.id">
          <td data-label="Клієнт" class="px-4 py-3 font-medium text-slate-900">{{ recipient.name || `Клієнт #${recipient.id}` }}</td>
          <td data-label="Телефон" class="px-4 py-3 text-slate-700">{{ recipient.phone }}</td>
          <td data-label="Telegram" class="px-4 py-3 text-slate-700">{{ recipient.telegram_chat_id || 'немає' }}</td>
          <td data-label="Згода" class="px-4 py-3">
            <span class="rounded-full px-2 py-1 text-xs font-medium" :class="recipient.marketing_consent && !recipient.opt_out ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'">
              {{ recipient.marketing_consent && !recipient.opt_out ? 'дозволено' : 'не надсилати' }}
            </span>
          </td>
          <td data-label="Мова" class="px-4 py-3 text-slate-700">{{ recipient.preferred_language || 'uk' }}</td>
          <td data-label="Статус" class="px-4 py-3">
            <span class="rounded-full px-2 py-1 text-xs font-medium" :class="recipient.eligible ? 'bg-cyan-50 text-cyan-700' : 'bg-amber-50 text-amber-700'">
              {{ recipient.eligible ? 'готовий' : recipient.exclusion_reason || 'виключено' }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="p-6 text-sm text-slate-500">{{ emptyLabel || 'Отримувачів за цими правилами не знайдено.' }}</div>
  </div>
</template>

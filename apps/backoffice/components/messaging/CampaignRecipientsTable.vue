<script setup lang="ts">
import type { MessageRecipient } from '~/types/messaging'

defineProps<{
  recipients: MessageRecipient[]
  pending?: boolean
  emptyLabel?: string
}>()
</script>

<template>
  <div class="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm">
    <div v-if="pending" class="p-6 text-sm text-slate-500">Завантажуємо отримувачів...</div>
    <table v-else-if="recipients.length" class="min-w-full divide-y divide-slate-200 text-sm">
      <thead class="bg-slate-50">
        <tr>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Клієнт</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Заплановано</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Надіслано</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Спроби</th>
          <th class="px-4 py-3 text-left font-medium text-slate-500">Помилка</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="(recipient, index) in recipients" :key="`${recipient.id}-${recipient.customer_id}-${index}`">
          <td data-label="Клієнт" class="px-4 py-3">
            <NuxtLink :to="`/customers/${recipient.customer_id}`" class="font-medium text-cyan-700">
              Customer #{{ recipient.customer_id }}
            </NuxtLink>
            <p v-if="recipient.appointment_id" class="mt-1 text-xs text-slate-500">Booking #{{ recipient.appointment_id }}</p>
          </td>
          <td data-label="Статус" class="px-4 py-3">
            <span
              class="rounded-full px-2 py-1 text-xs font-medium"
              :class="recipient.status === 'failed'
                ? 'bg-rose-50 text-rose-700'
                : recipient.status === 'skipped'
                  ? 'bg-amber-50 text-amber-700'
                  : recipient.status === 'sent' || recipient.status === 'delivered'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-cyan-50 text-cyan-700'"
            >
              {{ recipient.status }}
            </span>
          </td>
          <td data-label="Заплановано" class="px-4 py-3 text-slate-700">
            {{ recipient.scheduled_at ? new Date(recipient.scheduled_at).toLocaleString('uk-UA') : '—' }}
          </td>
          <td data-label="Надіслано" class="px-4 py-3 text-slate-700">
            {{ recipient.sent_at ? new Date(recipient.sent_at).toLocaleString('uk-UA') : '—' }}
          </td>
          <td data-label="Спроби" class="px-4 py-3 text-slate-700">{{ recipient.attempts }}</td>
          <td data-label="Помилка" class="px-4 py-3 text-slate-700">{{ recipient.last_error || '—' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="p-6 text-sm text-slate-500">{{ emptyLabel || 'Отримувачів поки немає.' }}</p>
  </div>
</template>

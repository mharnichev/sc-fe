<script setup lang="ts">
import type { MessageRecipient } from '~/types/messaging'

defineProps<{
  recipients: MessageRecipient[]
  pending?: boolean
  emptyLabel?: string
}>()
</script>

<template>
  <BaseTable
    caption="Отримувачі кампанії"
    min-width="64rem"
    :loading="pending"
    loading-label="Завантажуємо отримувачів…"
    :empty="!recipients.length"
    :empty-title="emptyLabel || 'Отримувачів поки немає'"
  >
    <template #head>
        <tr>
          <th>Клієнт</th>
          <th>Статус</th>
          <th>Заплановано</th>
          <th>Надіслано</th>
          <th>Спроби</th>
          <th>Помилка</th>
        </tr>
    </template>
        <tr v-for="(recipient, index) in recipients" :key="`${recipient.id}-${recipient.customer_id}-${index}`">
          <td>
            <NuxtLink :to="`/customers/${recipient.customer_id}`" class="font-medium text-ui-accent hover:underline">
              Customer #{{ recipient.customer_id }}
            </NuxtLink>
            <p v-if="recipient.appointment_id" class="mt-1 text-xs text-ui-muted">Booking #{{ recipient.appointment_id }}</p>
          </td>
          <td>
            <BaseBadge
              :tone="recipient.status === 'failed'
                ? 'danger'
                : recipient.status === 'skipped'
                  ? 'warning'
                  : recipient.status === 'sent' || recipient.status === 'delivered'
                    ? 'success'
                    : 'info'"
            >
              {{ recipient.status }}
            </BaseBadge>
          </td>
          <td class="whitespace-nowrap text-ui-secondary">
            {{ recipient.scheduled_at ? new Date(recipient.scheduled_at).toLocaleString('uk-UA') : '—' }}
          </td>
          <td class="whitespace-nowrap text-ui-secondary">
            {{ recipient.sent_at ? new Date(recipient.sent_at).toLocaleString('uk-UA') : '—' }}
          </td>
          <td class="text-ui-secondary">{{ recipient.attempts }}</td>
          <td class="max-w-sm text-ui-secondary">{{ recipient.last_error || '—' }}</td>
        </tr>
  </BaseTable>
</template>

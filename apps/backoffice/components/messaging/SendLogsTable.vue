<script setup lang="ts">
import type { SendLog } from '~/types/messaging'

defineProps<{ logs: SendLog[], pending?: boolean }>()
const emit = defineEmits<{ retry: [log: SendLog] }>()
</script>

<template>
  <BaseTable
    sticky-actions
    caption="Журнал відправок"
    min-width="60rem"
    :loading="pending"
    loading-label="Завантажуємо журнал відправок…"
    :empty="!logs.length"
    empty-title="Журнал відправок ще порожній"
  >
    <template #head>
        <tr>
          <th>Клієнт</th>
          <th>Телефон</th>
          <th>Telegram</th>
          <th>Час</th>
          <th>Причина</th>
          <th>Дія</th>
        </tr>
    </template>
        <tr v-for="log in logs" :key="log.id">
          <td class="font-medium text-ui-primary">{{ log.client_name }}</td>
          <td class="text-ui-secondary">{{ log.phone }}</td>
          <td>
            <BaseBadge :tone="log.telegram_status === 'failed' ? 'danger' : 'success'">
              {{ log.telegram_status }}
            </BaseBadge>
          </td>
          <td class="whitespace-nowrap text-ui-secondary">{{ log.sent_at ? new Date(log.sent_at).toLocaleString('uk-UA') : '—' }}</td>
          <td class="max-w-sm text-ui-secondary">{{ log.failure_reason || '—' }}</td>
          <td>
            <BaseButton
              type="button"
              variant="neutral"
              size="sm"
              :disabled="log.telegram_status !== 'failed'"
              @click="emit('retry', log)"
            >
              Повторити
            </BaseButton>
          </td>
        </tr>
  </BaseTable>
</template>

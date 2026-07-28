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
  <div v-if="error" class="ui-status-danger rounded-[1.25rem] p-6 text-sm" role="alert">{{ error }}</div>
  <BaseTable
    v-else
    caption="Попередній перегляд отримувачів"
    min-width="52rem"
    :loading="pending"
    loading-label="Завантажуємо отримувачів…"
    :empty="!recipients.length"
    :empty-title="emptyLabel || 'Отримувачів за цими правилами не знайдено'"
  >
    <template #head>
        <tr>
          <th>Клієнт</th>
          <th>Телефон</th>
          <th>Telegram</th>
          <th>Згода</th>
          <th>Мова</th>
          <th>Статус</th>
        </tr>
    </template>
        <tr v-for="recipient in recipients" :key="recipient.id">
          <td class="font-medium text-ui-primary">{{ recipient.name || `Клієнт #${recipient.id}` }}</td>
          <td class="text-ui-secondary">{{ recipient.phone }}</td>
          <td class="text-ui-secondary">{{ recipient.telegram_chat_id || 'немає' }}</td>
          <td>
            <BaseBadge :tone="recipient.marketing_consent && !recipient.opt_out ? 'success' : 'danger'">
              {{ recipient.marketing_consent && !recipient.opt_out ? 'дозволено' : 'не надсилати' }}
            </BaseBadge>
          </td>
          <td class="text-ui-secondary">{{ recipient.preferred_language || 'uk' }}</td>
          <td>
            <BaseBadge :tone="recipient.eligible ? 'info' : 'warning'">
              {{ recipient.eligible ? 'готовий' : recipient.exclusion_reason || 'виключено' }}
            </BaseBadge>
          </td>
        </tr>
  </BaseTable>
</template>

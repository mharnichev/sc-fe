<script setup lang="ts">
import type { SendLog } from '~/types/messaging'
import { deliveryReasonLabel } from '~/utils/campaignAudience.mjs'

const props = defineProps<{ logs: SendLog[], pending?: boolean, retryable?: boolean }>()
const emit = defineEmits<{ retry: [log: SendLog] }>()
const customer = ref('')
const channel = ref('')
const status = ref('')
const { channelLabel } = useMessagingUi()
const statusLabels: Record<string, string> = { pending: 'Очікує', queued: 'У черзі', sent: 'Прийнято провайдером', delivered: 'Доставлено', failed: 'Помилка', skipped: 'Пропущено' }
const channelOptions = computed(() => [
  { value: '', label: 'Усі канали' },
  ...[...new Set(props.logs.map(log => log.channel).filter(Boolean))].map(value => ({ value: value!, label: channelLabel(value!) })),
])
const filteredLogs = computed(() => props.logs.filter(log =>
  (!customer.value.trim() || `${log.client_id} ${log.client_name} ${log.phone}`.toLocaleLowerCase('uk-UA').includes(customer.value.trim().toLocaleLowerCase('uk-UA')))
  && (!channel.value || log.channel === channel.value)
  && (!status.value || log.telegram_status === status.value),
))
</script>

<template>
  <div class="space-y-3">
  <p class="text-sm text-ui-muted">Фільтри застосовуються до поточної сторінки журналу.</p>
  <div class="grid gap-3 sm:grid-cols-3">
    <BaseInput v-model="customer" label="Клієнт у журналі" placeholder="Ім’я, телефон або номер" />
    <BaseSelect v-model="channel" label="Канал у журналі" :options="channelOptions" />
    <BaseSelect v-model="status" label="Статус у журналі" :options="[{ value: '', label: 'Усі статуси' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]" />
  </div>
  <BaseTable
    sticky-actions
    caption="Журнал відправок"
    min-width="60rem"
    :loading="pending"
    loading-label="Завантажуємо журнал відправок…"
    :empty="!filteredLogs.length"
    empty-title="Журнал відправок ще порожній"
  >
    <template #head>
        <tr>
          <th>Клієнт</th>
          <th>Телефон</th>
          <th>Канал / статус</th>
          <th>Джерело</th>
          <th>Час</th>
          <th>Причина</th>
          <th v-if="retryable">Дія</th>
        </tr>
    </template>
        <tr v-for="log in filteredLogs" :key="log.id">
          <td class="font-medium text-ui-primary"><NuxtLink :to="`/customers/${log.client_id}`" class="underline">{{ log.client_name }}</NuxtLink></td>
          <td class="text-ui-secondary">{{ log.phone || 'Немає даних' }}</td>
          <td>
            <span class="mr-2">{{ log.channel ? channelLabel(log.channel) : 'Канал не вказано' }}</span>
            <BaseBadge :tone="log.telegram_status === 'failed' ? 'danger' : 'success'">
              {{ statusLabels[log.telegram_status] || log.telegram_status }}
            </BaseBadge>
          </td>
          <td><NuxtLink v-if="log.campaign_id" :to="`/messaging/campaigns/${log.campaign_id}#delivery-journal`" class="underline">Повідомлення №{{ log.campaign_id }}</NuxtLink><span v-else>Немає даних</span></td>
          <td class="whitespace-nowrap text-ui-secondary">{{ log.sent_at ? new Date(log.sent_at).toLocaleString('uk-UA') : '—' }}</td>
          <td class="max-w-sm text-ui-secondary">{{ deliveryReasonLabel(log.failure_reason) }}</td>
          <td v-if="retryable">
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
  </div>
</template>

<script setup lang="ts">
import { EyeIcon } from '@heroicons/vue/24/outline'
import type { OrderSummary } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const { formatDateTime, formatMoney } = useBookingFormatting()
const page = ref(1)
const pageSize = 20

const { data } = await useAsyncData(
  'backoffice-orders-list',
  () => api.getOrders(page.value, pageSize),
  { watch: [page] },
)

const deliveryLabel = (order: OrderSummary) =>
  [order.shipping_company, order.shipping_method].filter(Boolean).join(' · ') || '—'

const next = async () => {
  if (!data.value || page.value * pageSize >= data.value.total) return
  page.value += 1
}

const prev = async () => {
  page.value = Math.max(1, page.value - 1)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Продажі</p>
      <h1 class="mt-2 text-3xl font-semibold text-ui-primary">Замовлення</h1>
    </div>

    <BaseCard variant="subtle" padding="sm" class="text-sm text-ui-secondary">
      Total: {{ data?.total || 0 }}
    </BaseCard>

    <BaseTable
      caption="Замовлення магазину"
      min-width="1120px"
      :empty="!data?.items.length"
      empty-title="Замовлень немає"
    >
      <template #head>
        <tr>
          <th>Замовлення</th>
          <th>Клієнт</th>
          <th>Контакти</th>
          <th>Доставка</th>
          <th>Оплата</th>
          <th>Sync</th>
          <th>Усього</th>
          <th>Статус</th>
          <th>Створено</th>
          <th>Дії</th>
        </tr>
      </template>
          <tr v-for="order in data?.items || []" :key="order.id">
            <td data-label="Замовлення" class="px-4 py-3">
              <NuxtLink :to="`/orders/${order.id}`" class="font-medium text-ui-primary hover:underline">
                #{{ order.id }}
              </NuxtLink>
            </td>
            <td data-label="Клієнт" class="text-ui-secondary">
              {{ order.customer_name }}
            </td>
            <td data-label="Контакти" class="px-4 py-3">
              <p class="text-ui-secondary">{{ order.customer_email || '—' }}</p>
              <p class="text-xs text-ui-muted">{{ order.customer_phone || 'Без телефону' }}</p>
            </td>
            <td data-label="Доставка" class="px-4 py-3">
              <p class="text-ui-secondary">{{ order.shipping_city || '—' }}</p>
              <p class="text-xs text-ui-muted">{{ deliveryLabel(order) }}</p>
            </td>
            <td data-label="Оплата" class="text-ui-secondary">
              {{ order.payment_method || '—' }}
            </td>
            <td data-label="Sync" class="text-ui-secondary">
              {{ order.external_sync_status || '—' }}
            </td>
            <td data-label="Усього" class="font-medium text-ui-primary">
              {{ formatMoney(order.total_amount) }}
            </td>
            <td data-label="Статус" class="px-4 py-3">
              <BaseBadge tone="neutral" class="uppercase tracking-[0.15em]">
                {{ order.status }}
              </BaseBadge>
            </td>
            <td data-label="Створено" class="text-ui-secondary">
              {{ formatDateTime(order.created_at) }}
            </td>
            <td data-label="Дії" class="px-4 py-3">
              <NuxtLink
                :to="`/orders/${order.id}`"
                class="base-button base-button--icon h-8 w-8 p-0"
                aria-label="Переглянути замовлення"
                title="Переглянути"
              >
                <EyeIcon class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only">Переглянути</span>
              </NuxtLink>
            </td>
          </tr>
    </BaseTable>

    <div class="flex flex-wrap gap-3">
      <BaseButton variant="neutral" :disabled="page === 1" @click="prev">Попередня</BaseButton>
      <BaseButton variant="neutral" :disabled="!data || page * pageSize >= data.total" @click="next">Наступна</BaseButton>
    </div>
  </div>
</template>

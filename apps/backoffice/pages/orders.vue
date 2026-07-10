<script setup lang="ts">
import { EyeIcon } from '@heroicons/vue/24/outline'
import type { OrderSummary } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const { formatDateTime, formatMoney } = useBookingFormatting()
const page = ref(1)
const pageSize = 20

const { data } = await useAsyncData(
  'backoffice-orders',
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
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Продажі</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Замовлення</h1>
    </div>

    <div class="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Total: {{ data?.total || 0 }}
    </div>

    <div class="overflow-x-auto rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <table class="min-w-[1120px] divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Замовлення</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Клієнт</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Контакти</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Доставка</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Оплата</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Sync</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Усього</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Статус</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Створено</th>
            <th class="px-4 py-3 text-left font-medium text-slate-500">Дії</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="order in data?.items || []" :key="order.id">
            <td data-label="Замовлення" class="px-4 py-3">
              <NuxtLink :to="`/orders/${order.id}`" class="font-medium text-slate-900 hover:text-cyan-700">
                #{{ order.id }}
              </NuxtLink>
            </td>
            <td data-label="Клієнт" class="px-4 py-3 text-slate-700">
              {{ order.customer_name }}
            </td>
            <td data-label="Контакти" class="px-4 py-3">
              <p class="text-slate-700">{{ order.customer_email || '—' }}</p>
              <p class="text-xs text-slate-500">{{ order.customer_phone || 'Без телефону' }}</p>
            </td>
            <td data-label="Доставка" class="px-4 py-3">
              <p class="text-slate-700">{{ order.shipping_city || '—' }}</p>
              <p class="text-xs text-slate-500">{{ deliveryLabel(order) }}</p>
            </td>
            <td data-label="Оплата" class="px-4 py-3 text-slate-700">
              {{ order.payment_method || '—' }}
            </td>
            <td data-label="Sync" class="px-4 py-3 text-slate-700">
              {{ order.external_sync_status || '—' }}
            </td>
            <td data-label="Усього" class="px-4 py-3 font-medium text-slate-900">
              {{ formatMoney(order.total_amount) }}
            </td>
            <td data-label="Статус" class="px-4 py-3">
              <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.15em] text-slate-700">
                {{ order.status }}
              </span>
            </td>
            <td data-label="Створено" class="px-4 py-3 text-slate-700">
              {{ formatDateTime(order.created_at) }}
            </td>
            <td data-label="Дії" class="px-4 py-3">
              <NuxtLink
                :to="`/orders/${order.id}`"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                aria-label="Переглянути замовлення"
                title="Переглянути"
              >
                <EyeIcon class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only">Переглянути</span>
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap gap-3">
      <BaseButton :disabled="page === 1" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="prev">Попередня</BaseButton>
      <BaseButton :disabled="!data || page * pageSize >= data.total" class="rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" @click="next">Наступна</BaseButton>
    </div>
  </div>
</template>

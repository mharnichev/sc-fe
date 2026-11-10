<script setup lang="ts">
import { orderPaymentMethodLabel } from '~/utils/orderSales'
import OrderProjections from '~/components/orders/OrderProjections.vue'
import { EyeIcon } from '@heroicons/vue/24/outline'
import type { OrderSummary } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const { formatDateTime, formatMoney } = useBookingFormatting()
const route = useRoute()
const router = useRouter()
const archive = computed(() => route.query.archive === 'archived' ? 'archived' : 'active')
const search = ref('')
const searchDraft = ref('')
const page = ref(1)
watch(archive, () => { page.value = 1 }, { flush: 'sync' })
const pageSize = 20

const { data, pending, error } = await useAsyncData(
  'backoffice-orders-list',
  () => api.getOrders(page.value, pageSize, { archive: archive.value, search: search.value }),
  { watch: [page, archive, search] },
)

const selectArchive = (scope: 'active' | 'archived') => router.push({
  query: { archive: scope === 'archived' ? scope : undefined },
})
const submitSearch = () => {
  page.value = 1
  search.value = searchDraft.value.trim().slice(0, 120)
}
const statusLabels: Record<string, string> = {
  pending: 'Очікує', confirmed: 'Підтверджено', paid: 'Оплачено', completed: 'Завершено', cancelled: 'Скасовано',
}

const deliveryLabel = (order: OrderSummary) =>
  [order.shipping_company, order.shipping_method].filter(Boolean).join(' · ') || '—'

</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Продажі</p>
      <h1 class="mt-2 text-3xl font-semibold text-ui-primary">Замовлення</h1>
      <NuxtLink to="/orders/pos" class="base-button mt-4">Продати товар</NuxtLink>
    </div>

    <BaseCard variant="subtle" padding="sm" class="space-y-3">
      <nav aria-label="Список замовлень" class="flex flex-wrap gap-2">
        <BaseButton :variant="archive === 'active' ? 'primary' : 'neutral'" :aria-pressed="archive === 'active'" @click="selectArchive('active')">Активні</BaseButton>
        <BaseButton :variant="archive === 'archived' ? 'primary' : 'neutral'" :aria-pressed="archive === 'archived'" @click="selectArchive('archived')">Архів</BaseButton>
      </nav>
      <form class="flex flex-wrap items-end gap-2" role="search" @submit.prevent="submitSearch">
        <BaseInput v-model="searchDraft" type="search" :maxlength="120" label="Пошук замовлень" placeholder="Номер, ім’я, телефон або email" class="min-w-0 flex-1" />
        <BaseButton variant="neutral" type="submit">Знайти</BaseButton>
      </form>
    </BaseCard>
    <p v-if="error" role="alert" class="text-sm text-ui-secondary">Не вдалося завантажити замовлення.</p>
    <p v-else-if="pending" role="status" class="text-sm text-ui-secondary">Завантажуємо замовлення…</p>

    <BaseTable
      v-else
      sticky-actions
      :caption="archive === 'archived' ? 'Архів замовлень' : 'Активні замовлення'"
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
              <p>{{ orderPaymentMethodLabel(order) }}</p>
              <OrderProjections :order="order" />
            </td>
            <td data-label="Sync" class="text-ui-secondary">
              {{ order.external_sync_status || '—' }}
            </td>
            <td data-label="Усього" class="font-medium text-ui-primary">
              <p>Разом: {{ formatMoney(order.total_amount) }}</p>
              <p class="mt-1 text-xs font-normal text-ui-muted">Підсумок: {{ formatMoney(order.subtotal_amount) }}</p>
              <p class="text-xs font-normal text-ui-muted">Знижка: {{ formatMoney(order.discount_amount) }}</p>
              <p v-if="order.promo_code" class="text-xs font-normal text-ui-muted">Промокод: {{ order.promo_code }}</p>
            </td>
            <td data-label="Статус" class="px-4 py-3">
              <BaseBadge :tone="order.status === 'cancelled' ? 'danger' : 'neutral'">
                {{ statusLabels[order.status] || order.status }}
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

    <div v-if="!pending && !error && (page > 1 || (data?.total || 0) > pageSize)" class="flex flex-wrap gap-3">
      <BaseButton variant="neutral" :disabled="page === 1" @click="page--">Попередня</BaseButton>
      <BaseButton variant="neutral" :disabled="!data || page * pageSize >= data.total" @click="page++">Наступна</BaseButton>
    </div>
  </div>
</template>

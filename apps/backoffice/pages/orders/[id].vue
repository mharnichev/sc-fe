<script setup lang="ts">
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { apiErrorMessage, formatDateTime, formatMoney } = useBookingFormatting()

const orderId = computed(() => route.params.id as string)

const {
  data: order,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `backoffice-order-${orderId.value}`,
  () => api.getOrder(orderId.value),
  { watch: [orderId] },
)

const statusDraft = ref('')
const statusPending = ref(false)
const statusError = ref('')

const statusOptions = [
  { value: 'pending', label: 'Очікує' },
  { value: 'confirmed', label: 'Підтверджено' },
  { value: 'paid', label: 'Оплачено' },
  { value: 'completed', label: 'Завершено' },
  { value: 'cancelled', label: 'Скасовано' },
]

const statusLabels = Object.fromEntries(statusOptions.map(option => [option.value, option.label]))

const statusBadgeClass = (status?: string | null) => {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700'
  if (status === 'paid') return 'bg-cyan-50 text-cyan-700'
  if (status === 'confirmed') return 'bg-blue-50 text-blue-700'
  if (status === 'cancelled') return 'bg-rose-50 text-rose-700'
  return 'bg-amber-50 text-amber-700'
}

const displayValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

const fullCustomerName = computed(() => {
  if (!order.value) return '—'
  const fromParts = [order.value.first_name, order.value.last_name].filter(Boolean).join(' ')
  return fromParts || order.value.customer_name || '—'
})

const shippingRows = computed(() => {
  const item = order.value
  if (!item) return []
  return [
    { label: 'Компанія', value: item.shipping_company },
    { label: 'Метод', value: item.shipping_method },
    { label: 'Область', value: item.shipping_area },
    { label: 'Місто', value: item.shipping_city },
    { label: 'Відділення', value: item.shipping_warehouse_number },
    { label: 'Вулиця', value: item.shipping_street },
    { label: 'Будинок', value: item.building_number },
    { label: 'Квартира', value: item.shipping_apartment },
    { label: 'Адреса доставки', value: item.delivery_address },
    { label: 'ТТН', value: item.tracking_number },
  ]
})

const syncRows = computed(() => {
  const item = order.value
  if (!item) return []
  return [
    { label: 'Метод оплати', value: item.payment_method },
    { label: 'External ID', value: item.external_id },
    { label: 'Sync status', value: item.external_sync_status },
    { label: 'Sync error', value: item.external_sync_error },
  ]
})

const shippingPayloadEntries = computed(() => {
  const payload = order.value?.shipping_payload_json
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  return Object.entries(payload)
})

watch(
  () => order.value?.status,
  value => {
    statusDraft.value = value || ''
  },
  { immediate: true },
)

const updateStatus = async () => {
  if (!order.value || !statusDraft.value || statusDraft.value === order.value.status) return

  statusPending.value = true
  statusError.value = ''

  try {
    order.value = await api.updateOrderStatus(order.value.id, statusDraft.value)
    toast.success('Статус замовлення оновлено.')
    await refresh()
  }
  catch (err: unknown) {
    statusError.value = apiErrorMessage(err, 'Не вдалося оновити статус замовлення.')
    toast.error(statusError.value)
  }
  finally {
    statusPending.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Продажі</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">
          Замовлення #{{ orderId }}
        </h1>
        <p v-if="order?.created_at" class="mt-2 text-sm text-slate-500">
          Створено {{ formatDateTime(order.created_at) }}
        </p>
      </div>
      <NuxtLink
        to="/orders"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
        До замовлень
      </NuxtLink>
    </div>

    <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
      {{ apiErrorMessage(error, 'Не вдалося завантажити замовлення.') }}
    </p>

    <div v-if="pending" class="space-y-4">
      <div v-for="index in 4" :key="index" class="h-24 animate-pulse rounded-[1.5rem] bg-slate-100" />
    </div>

    <div v-else-if="order" class="space-y-6">
      <section class="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
        <div class="flex flex-wrap items-center gap-3">
          <span
            class="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.15em]"
            :class="statusBadgeClass(order.status)"
          >
            {{ statusLabels[order.status] || order.status }}
          </span>
          <span class="text-sm text-slate-500">
            Разом: <strong class="font-semibold text-slate-900">{{ formatMoney(order.total_amount) }}</strong>
          </span>
        </div>
        <form class="grid gap-3 sm:grid-cols-[minmax(12rem,16rem)_auto]" @submit.prevent="updateStatus">
          <BaseSelect
            native
            v-model="statusDraft"
            class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            :disabled="statusPending"
          >
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </BaseSelect>
          <BaseButton
            type="submit"
            :loading="statusPending"
            :disabled="statusDraft === order.status"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
            Оновити статус
          </BaseButton>
        </form>
      </section>

      <p v-if="statusError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ statusError }}
      </p>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
        <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="text-xl font-semibold text-slate-900">Позиції</h2>
          <BaseTable
            caption="Позиції замовлення"
            wrapper-class="mt-4 rounded-2xl"
            min-width="720px"
          >
            <template #head>
                <tr>
                  <th>Товар</th>
                  <th>SKU</th>
                  <th>К-сть</th>
                  <th>Ціна</th>
                  <th>Сума</th>
                </tr>
            </template>
                <tr v-for="item in order.items" :key="item.id">
                  <td>
                    <p class="font-medium text-ui-primary">{{ item.product_name || `Товар #${item.product_id}` }}</p>
                    <p class="mt-1 text-xs text-ui-muted">Product ID: {{ item.product_id }}</p>
                  </td>
                  <td class="text-ui-secondary">{{ item.product_sku || '—' }}</td>
                  <td class="text-ui-secondary">{{ item.quantity }}</td>
                  <td class="text-ui-secondary">{{ formatMoney(item.price) }}</td>
                  <td class="font-medium text-ui-primary">{{ formatMoney(item.total_price || Number(item.price) * item.quantity) }}</td>
                </tr>
          </BaseTable>
        </section>

        <section class="space-y-6">
          <div class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="text-xl font-semibold text-slate-900">Контакт</h2>
            <dl class="mt-4 space-y-4 text-sm">
              <div class="grid grid-cols-[120px_1fr] gap-3">
                <dt class="text-slate-500">Клієнт</dt>
                <dd class="font-medium text-slate-900">{{ fullCustomerName }}</dd>
              </div>
              <div class="grid grid-cols-[120px_1fr] gap-3">
                <dt class="text-slate-500">Телефон</dt>
                <dd class="font-medium text-slate-900">{{ displayValue(order.customer_phone) }}</dd>
              </div>
              <div class="grid grid-cols-[120px_1fr] gap-3">
                <dt class="text-slate-500">Email</dt>
                <dd class="font-medium break-all text-slate-900">{{ displayValue(order.customer_email) }}</dd>
              </div>
              <div class="grid grid-cols-[120px_1fr] gap-3">
                <dt class="text-slate-500">Коментар</dt>
                <dd class="font-medium whitespace-pre-line text-slate-900">{{ displayValue(order.comment) }}</dd>
              </div>
            </dl>
          </div>

          <div class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="text-xl font-semibold text-slate-900">Доставка</h2>
            <dl class="mt-4 space-y-4 text-sm">
              <div v-for="row in shippingRows" :key="row.label" class="grid grid-cols-[120px_1fr] gap-3">
                <dt class="text-slate-500">{{ row.label }}</dt>
                <dd class="font-medium break-words text-slate-900">{{ displayValue(row.value) }}</dd>
              </div>
            </dl>
          </div>

          <div class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 class="text-xl font-semibold text-slate-900">Оплата та sync</h2>
            <dl class="mt-4 space-y-4 text-sm">
              <div v-for="row in syncRows" :key="row.label" class="grid grid-cols-[120px_1fr] gap-3">
                <dt class="text-slate-500">{{ row.label }}</dt>
                <dd class="font-medium break-words text-slate-900">{{ displayValue(row.value) }}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      <section v-if="shippingPayloadEntries.length" class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Shipping payload</h2>
        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <article v-for="[key, value] in shippingPayloadEntries" :key="key" class="rounded-2xl bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.2em] text-slate-500">{{ key }}</p>
            <pre class="mt-2 overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-slate-700">{{ typeof value === 'string' ? value : JSON.stringify(value, null, 2) }}</pre>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

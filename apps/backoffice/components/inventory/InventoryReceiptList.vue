<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { inventoryApiErrorMessage, inventoryDocumentStatusLabel } from '~/utils/inventory'

const api = useBackofficeApi()
const { formatDateTime } = useBookingFormatting()
const page = ref(1)
const pageSize = 20
const { data, pending, error, refresh } = await useAsyncData(
  'inventory-receipts',
  () => api.getInventoryReceipts(page.value, pageSize),
  { watch: [page], server: false },
)
</script>

<template>
  <BaseCard as="section" padding="sm" class="space-y-4" aria-labelledby="receipt-list-title">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="receipt-list-title" class="text-lg font-semibold text-ui-primary">Список приймань</h2>
        <p class="mt-1 text-sm text-ui-secondary">Усі приймання, включно з чернетками. Відкрийте документ, щоб продовжити роботу або переглянути його.</p>
      </div>
      <BaseButton variant="neutral" class="min-h-11" :loading="pending" @click="refresh()"><ArrowPathIcon class="h-4 w-4" aria-hidden="true" />Оновити список</BaseButton>
    </div>
    <p v-if="error" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ inventoryApiErrorMessage(error, 'Не вдалося завантажити список приймань.') }}</p>
    <p v-else-if="pending" role="status" class="text-sm text-ui-muted">Завантаження приймань…</p>
    <BaseEmptyState v-else-if="!data?.items.length" title="Приймань ще немає" description="Створіть першу чернетку за допомогою форми нижче." />
    <template v-else>
      <div class="space-y-2 md:hidden">
        <NuxtLink v-for="receipt in data.items" :key="receipt.id" :to="{ path: '/inventory/receiving', query: { id: String(receipt.id) } }" class="block rounded-xl border border-ui-border p-3 hover:bg-ui-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <div class="flex items-center justify-between gap-3"><span class="font-medium text-ui-primary">Приймання #{{ receipt.id }}</span><BaseBadge :tone="receipt.status === 'posted' ? 'success' : 'neutral'">{{ inventoryDocumentStatusLabel(receipt.status) }}</BaseBadge></div>
          <p class="mt-2 break-words text-sm text-ui-secondary">{{ receipt.reason }}</p>
          <p class="mt-1 text-xs text-ui-muted">{{ formatDateTime(receipt.created_at) }} · Позицій: {{ receipt.items.length }}</p>
        </NuxtLink>
      </div>
      <BaseTable wrapper-class="hidden md:block" caption="Список приймань" min-width="40rem">
        <template #head><tr><th>Документ</th><th>Створено</th><th>Причина</th><th>Статус</th><th>Позицій</th></tr></template>
        <tr v-for="receipt in data.items" :key="receipt.id">
          <td><NuxtLink :to="{ path: '/inventory/receiving', query: { id: String(receipt.id) } }" class="inline-flex min-h-11 items-center font-medium text-ui-accent hover:underline">Приймання #{{ receipt.id }}</NuxtLink></td>
          <td class="whitespace-nowrap text-ui-secondary">{{ formatDateTime(receipt.created_at) }}</td>
          <td class="max-w-xs break-words text-ui-secondary">{{ receipt.reason }}</td>
          <td><BaseBadge :tone="receipt.status === 'posted' ? 'success' : 'neutral'">{{ inventoryDocumentStatusLabel(receipt.status) }}</BaseBadge></td>
          <td class="text-ui-secondary">{{ receipt.items.length }}</td>
        </tr>
      </BaseTable>
    </template>
    <div v-if="data && data.total > pageSize" class="flex flex-wrap items-center justify-end gap-2">
      <span class="text-sm text-ui-muted">Сторінка {{ page }} · Усього: {{ data.total }}</span>
      <BaseButton variant="neutral" class="min-h-11" :disabled="pending || page === 1" @click="page--">Попередня</BaseButton>
      <BaseButton variant="neutral" class="min-h-11" :disabled="pending || page * pageSize >= data.total" @click="page++">Наступна</BaseButton>
    </div>
  </BaseCard>
</template>

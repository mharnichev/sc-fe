<script setup lang="ts">
import type { ProcurementQueueItem } from '~/types/inventory'
import { inventoryApiErrorMessage, procurementStatusLabel } from '~/utils/inventory'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') return navigateTo('/')
  },
})

const api = useBackofficeApi()
const router = useRouter()
const toast = useBaseToastNotification()
const selectedIds = ref(new Set<number>())
const expandedProducts = ref(new Set<number>())
const markingOrdered = ref(false)
const actionError = ref('')
const orderContextByItem = ref<Record<number, { customer: string, ordered: number, fromStock: number }>>({})
let orderContextRequest = 0

const { data, pending, error, refresh } = await useAsyncData(
  'inventory-procurement-queue',
  () => api.getProcurementQueue(),
)
const rows = computed(() => data.value || [])
const selectedCount = computed(() => selectedIds.value.size)
const selectedRequirementCount = computed(() => rows.value.flatMap(row => row.requirements).filter(item => selectedIds.value.has(item.order_item_id)).length)

const toggleExpanded = (productId: number) => {
  const next = new Set(expandedProducts.value)
  if (next.has(productId)) next.delete(productId)
  else next.add(productId)
  expandedProducts.value = next
}
const setSelected = (orderItemId: number, checked: boolean) => {
  const next = new Set(selectedIds.value)
  if (checked) next.add(orderItemId)
  else next.delete(orderItemId)
  selectedIds.value = next
}
const toggleProductRequirements = (row: ProcurementQueueItem, checked: boolean) => {
  const next = new Set(selectedIds.value)
  for (const requirement of row.requirements) {
    if (requirement.procurement_status === 'to_order') {
      if (checked) next.add(requirement.order_item_id)
      else next.delete(requirement.order_item_id)
    }
  }
  selectedIds.value = next
}
const isProductSelected = (row: ProcurementQueueItem) => row.requirements.some(item => item.procurement_status === 'to_order' && selectedIds.value.has(item.order_item_id))
const startReceiving = (row: ProcurementQueueItem) => {
  // Allocations are accepted only for requirements already marked ordered.
  // Keep that context separate from the selections used to mark items ordered.
  const selected = row.requirements.filter(item => item.procurement_status === 'ordered')
  void router.push({
    path: '/inventory/receiving',
    query: {
      product_id: String(row.product_id),
      barcode: row.barcode || undefined,
      requirements: selected.length ? selected.map(item => `${item.order_item_id}:${item.quantity_required}`).join(',') : undefined,
    },
  })
}

watch(
  () => rows.value.flatMap(row => row.requirements.map(item => item.order_id)).join(','),
  async () => {
    const request = ++orderContextRequest
    const orderIds = [...new Set(rows.value.flatMap(row => row.requirements.map(item => item.order_id)))]
    const orders = new Array<Awaited<ReturnType<typeof api.getOrder>> | null>(orderIds.length).fill(null)
    let cursor = 0
    const worker = async () => {
      while (cursor < orderIds.length) {
        const index = cursor++
        try { orders[index] = await api.getOrder(orderIds[index]!) }
        catch { orders[index] = null }
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, orderIds.length) }, worker))
    if (request !== orderContextRequest) return
    const contexts: Record<number, { customer: string, ordered: number, fromStock: number }> = {}
    for (const order of orders) {
      if (!order) continue
      for (const item of order.items) {
        contexts[item.id] = {
          customer: order.customer_name || `Замовлення #${order.id}`,
          ordered: item.quantity,
          fromStock: item.quantity_from_stock,
        }
      }
    }
    orderContextByItem.value = contexts
  },
  { immediate: true },
)
const markOrdered = async () => {
  if (!selectedIds.value.size || markingOrdered.value) return
  actionError.value = ''
  markingOrdered.value = true
  try {
    await api.markProcurementOrdered([...selectedIds.value])
    toast.success('Позначено як замовлене.')
    selectedIds.value = new Set()
    await refresh()
  }
  catch (cause) { actionError.value = inventoryApiErrorMessage(cause, 'Не вдалося оновити статус закупівлі.') }
  finally {
    markingOrdered.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">Склад</p>
        <h1 class="mt-2 text-3xl font-semibold text-ui-primary">Черга закупівель</h1>
        <p class="mt-2 max-w-2xl text-sm text-ui-secondary">Потреби згруповано за товаром. Оберіть позиції замовлень, щоб позначити їх замовленими.</p>
      </div>
      <NuxtLink to="/inventory/receiving" class="base-button base-button--primary min-h-11 px-5 py-3 text-sm">Почати приймання</NuxtLink>
    </div>

    <div v-if="error" class="ui-status-danger rounded-2xl p-4 text-sm" role="alert">
      {{ inventoryApiErrorMessage(error, 'Не вдалося завантажити чергу.') }} <BaseButton variant="neutral" size="sm" @click="refresh()">Повторити</BaseButton>
    </div>
    <div v-if="actionError" class="ui-status-danger rounded-2xl p-4 text-sm" role="alert">{{ actionError }}</div>

    <BaseCard variant="subtle" padding="sm" class="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span class="text-ui-secondary">Обрано позицій: {{ selectedRequirementCount }}</span>
      <BaseButton variant="primary" :loading="markingOrdered" :disabled="!selectedCount" @click="markOrdered">Позначити замовленими</BaseButton>
    </BaseCard>

    <BaseTable :loading="pending" caption="Черга закупівель" min-width="62rem" :empty="!rows.length" empty-title="Потреб у закупівлі немає" empty-description="Нові потреби з'являться після замовлень, для яких бракує товару.">
      <template #head><tr><th>Товар</th><th>Потрібно</th><th>Артикул / штрихкод</th><th>Дії</th></tr></template>
      <template v-for="row in rows" :key="row.product_id">
        <tr>
          <td data-label="Товар"><BaseButton type="button" variant="unstyled" class="text-left font-medium text-ui-primary hover:underline" :aria-expanded="expandedProducts.has(row.product_id)" @click="toggleExpanded(row.product_id)">{{ row.product_name }}</BaseButton></td>
          <td data-label="Потрібно" class="font-medium text-ui-primary">{{ row.total_quantity_required }} шт.</td>
          <td data-label="Артикул / штрихкод" class="text-ui-secondary"><p>{{ row.sku || '—' }}</p><p class="text-xs text-ui-muted">{{ row.barcode || 'Без штрихкоду' }}</p></td>
          <td data-label="Дії" class="flex flex-wrap gap-2"><BaseButton variant="neutral" size="sm" @click="toggleExpanded(row.product_id)">{{ expandedProducts.has(row.product_id) ? 'Сховати' : 'Позиції' }}</BaseButton><BaseButton variant="primary" size="sm" @click="startReceiving(row)">Прийняти</BaseButton></td>
        </tr>
        <tr v-if="expandedProducts.has(row.product_id)" class="bg-ui-subtle">
          <td colspan="4" class="p-4">
            <BaseCheckbox class="mb-3" :model-value="isProductSelected(row)" label="Обрати всі, що треба замовити" @update:model-value="toggleProductRequirements(row, Boolean($event))" />
            <div class="space-y-2">
              <div v-for="requirement in row.requirements" :key="requirement.order_item_id" class="grid gap-2 rounded-xl border border-ui bg-ui-surface p-3 text-sm md:grid-cols-[auto_minmax(14rem,1fr)_repeat(4,auto)] md:items-center">
                <BaseCheckbox :model-value="selectedIds.has(requirement.order_item_id)" :disabled="requirement.procurement_status !== 'to_order'" :aria-label="`Обрати позицію ${requirement.order_item_id}`" @update:model-value="setSelected(requirement.order_item_id, Boolean($event))" />
                <NuxtLink :to="`/orders/${requirement.order_id}`" class="font-medium text-ui-primary hover:underline">Замовлення #{{ requirement.order_id }} · {{ orderContextByItem[requirement.order_item_id]?.customer || 'клієнт завантажується' }}</NuxtLink>
                <span>Замовлено клієнтом: {{ orderContextByItem[requirement.order_item_id]?.ordered ?? '—' }}</span><span>Зі складу: {{ orderContextByItem[requirement.order_item_id]?.fromStock ?? '—' }}</span><span>Ще потрібно: {{ requirement.quantity_required }}</span><span>Отримано: {{ requirement.quantity_received }}</span>
                <BaseBadge tone="neutral" class="w-fit uppercase">{{ procurementStatusLabel(requirement.procurement_status) }}</BaseBadge>
              </div>
            </div>
          </td>
        </tr>
      </template>
    </BaseTable>
  </div>
</template>

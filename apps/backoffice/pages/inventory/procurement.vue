<script setup lang="ts">
import { CheckIcon, PlusIcon, ArrowPathIcon, ShoppingBagIcon, ArrowDownTrayIcon, ChevronDownIcon, ClipboardDocumentListIcon } from '@heroicons/vue/24/outline'
import type { ProcurementQueueItem } from '~/types/inventory'
import { inventoryApiErrorMessage, procurementStatusLabel } from '~/utils/inventory'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && !auth.user?.can_post_inventory) return navigateTo('/')
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
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-semibold text-ui-primary sm:text-3xl"><ShoppingBagIcon class="h-6 w-6 shrink-0" aria-hidden="true" />Черга закупівель</h1>
        <p class="mt-1 max-w-2xl text-sm text-ui-secondary">Потреби згруповано за товаром. Оберіть позиції замовлень, щоб позначити їх замовленими.</p>
      </div>
      <NuxtLink to="/inventory/receiving" class="base-button base-button--primary flex min-h-11 w-full items-center justify-center gap-2 px-4 py-2 text-sm sm:w-auto"><ArrowDownTrayIcon class="h-5 w-5 shrink-0" aria-hidden="true" />Почати приймання</NuxtLink>
    </div>

    <InventorySectionNav />

    <div v-if="error" class="ui-status-danger rounded-2xl p-4 text-sm" role="alert">
      {{ inventoryApiErrorMessage(error, 'Не вдалося завантажити чергу.') }} <BaseButton variant="neutral" size="sm" @click="refresh()"><ArrowPathIcon class="h-4 w-4" aria-hidden="true" />Повторити</BaseButton>
    </div>
    <div v-if="actionError" class="ui-status-danger rounded-2xl p-4 text-sm" role="alert">{{ actionError }}</div>

    <BaseCard variant="subtle" padding="sm" class="flex flex-wrap items-center justify-between gap-4 text-sm">
      <span class="text-ui-secondary">Обрано позицій: {{ selectedRequirementCount }}</span>
      <BaseButton variant="primary" class="min-h-11 w-full sm:w-auto" :loading="markingOrdered" :disabled="!selectedCount" @click="markOrdered"><CheckIcon class="h-4 w-4" aria-hidden="true" />Позначити замовленими</BaseButton>
    </BaseCard>

    <div v-if="!pending && rows.length" class="space-y-4 md:hidden">
      <BaseCard v-for="row in rows" :key="row.product_id" as="article" padding="sm" class="space-y-4">
        <div class="flex items-start justify-between gap-3"><h2 class="flex min-w-0 items-start gap-2 text-sm font-semibold text-ui-primary"><ClipboardDocumentListIcon class="h-4 w-4 shrink-0 text-ui-muted" aria-hidden="true" /><span class="min-w-0 break-words [overflow-wrap:anywhere]">{{ row.product_name }}</span></h2><BaseBadge tone="neutral" class="shrink-0">{{ row.total_quantity_required }} шт.</BaseBadge></div>
        <p class="break-all text-xs text-ui-muted">SKU: {{ row.sku || '—' }} · {{ row.barcode || 'Без штрихкоду' }}</p>
        <div class="grid grid-cols-2 gap-2"><BaseButton variant="neutral" class="min-h-11" :aria-expanded="expandedProducts.has(row.product_id)" @click="toggleExpanded(row.product_id)"><ChevronDownIcon class="h-4 w-4 shrink-0" :class="expandedProducts.has(row.product_id) ? 'rotate-180' : ''" aria-hidden="true" />{{ expandedProducts.has(row.product_id) ? 'Сховати позиції' : 'Позиції замовлень' }}</BaseButton><BaseButton variant="primary" class="min-h-11" @click="startReceiving(row)"><PlusIcon class="h-4 w-4 shrink-0" aria-hidden="true" />Прийняти</BaseButton></div>
        <div v-if="expandedProducts.has(row.product_id)" class="space-y-4 border-t border-ui-border pt-4">
          <BaseCheckbox :model-value="isProductSelected(row)" label="Обрати всі, що треба замовити" @update:model-value="toggleProductRequirements(row, Boolean($event))" />
          <div v-for="requirement in row.requirements" :key="requirement.order_item_id" class="space-y-2 rounded-xl bg-ui-subtle p-3 text-xs">
            <div class="flex items-start gap-2"><BaseCheckbox :model-value="selectedIds.has(requirement.order_item_id)" :disabled="requirement.procurement_status !== 'to_order'" :aria-label="`Обрати позицію ${requirement.order_item_id}`" @update:model-value="setSelected(requirement.order_item_id, Boolean($event))" /><NuxtLink :to="`/orders/${requirement.order_id}`" class="font-medium text-ui-primary">Замовлення #{{ requirement.order_id }} · {{ orderContextByItem[requirement.order_item_id]?.customer || 'клієнт завантажується' }}</NuxtLink></div>
            <p class="text-ui-secondary">Замовлено: {{ orderContextByItem[requirement.order_item_id]?.ordered ?? '—' }} · Зі складу: {{ orderContextByItem[requirement.order_item_id]?.fromStock ?? '—' }}</p>
            <p class="text-ui-secondary">Ще потрібно: {{ requirement.quantity_required }} · Отримано: {{ requirement.quantity_received }}</p>
            <BaseBadge tone="neutral">{{ procurementStatusLabel(requirement.procurement_status) }}</BaseBadge>
          </div>
        </div>
      </BaseCard>
    </div>
    <BaseTable :wrapper-class="!pending && rows.length ? 'hidden md:block' : ''" :loading="pending" caption="Черга закупівель" min-width="62rem" :empty="!rows.length" empty-title="Потреб у закупівлі немає" empty-description="Нові потреби з'являться після замовлень, для яких бракує товару.">
      <template #head><tr><th>Товар</th><th>Потрібно</th><th>Артикул / штрихкод</th><th>Дії</th></tr></template>
      <template v-for="row in rows" :key="row.product_id">
        <tr>
          <td data-label="Товар"><BaseButton type="button" variant="unstyled" class="text-left font-medium text-ui-primary hover:underline" :aria-expanded="expandedProducts.has(row.product_id)" @click="toggleExpanded(row.product_id)">{{ row.product_name }}</BaseButton></td>
          <td data-label="Потрібно" class="font-medium text-ui-primary">{{ row.total_quantity_required }} шт.</td>
          <td data-label="Артикул / штрихкод" class="text-ui-secondary"><p>{{ row.sku || '—' }}</p><p class="text-xs text-ui-muted">{{ row.barcode || 'Без штрихкоду' }}</p></td>
          <td data-label="Дії" class="flex flex-wrap gap-2"><BaseButton variant="neutral" size="sm" @click="toggleExpanded(row.product_id)"><ChevronDownIcon class="h-4 w-4 shrink-0" :class="expandedProducts.has(row.product_id) ? 'rotate-180' : ''" aria-hidden="true" />{{ expandedProducts.has(row.product_id) ? 'Сховати' : 'Позиції' }}</BaseButton><BaseButton variant="primary" size="sm" @click="startReceiving(row)"><ArrowDownTrayIcon class="h-4 w-4 shrink-0" aria-hidden="true" />Прийняти</BaseButton></td>
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

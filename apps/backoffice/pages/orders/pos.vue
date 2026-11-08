<script setup lang="ts">
import { ArrowPathIcon, ClockIcon, ShoppingBagIcon } from '@heroicons/vue/24/outline'
import PosSaleSearch from '~/components/pos/PosSaleSearch.vue'
import PosSaleCart from '~/components/pos/PosSaleCart.vue'
import type { PosCartPromotion, PosCartQuote, PosOffer } from '~/types/posSale'
import PosSaleCheckout from '~/components/pos/PosSaleCheckout.vue'
import { posCanAddOffer, posDiscountLabels, posMoney } from '~/composables/usePosSale'
const sale = usePosSale()
const auth = useAuthStore()
const rows = ref<{ offer: PosOffer; quantity: number }[]>([])
const quantities = computed(() => Object.fromEntries(rows.value.map(row => [row.offer.id, row.quantity])))
const quote = shallowRef<PosCartQuote | null>(null)
const quoteBusy = ref(false)
const quoteError = ref('')
const promo = ref<string | null>(null)
const promotionId = ref<number | null>(null)
const promotions = shallowRef<PosCartPromotion[]>([])
let quotedItems = ''
const retry = ref(0)
const paying = ref(false)
const request = computed(() => ({
  items: rows.value.map(({ offer, quantity }) => ({ product_id: offer.id, quantity })),
  promo_code: promo.value,
  promotion_id: promotionId.value,
}))
const canPay = computed(() => !!quote.value && sale.allowed.value && !sale.saved.value && !paying.value)
watch(() => [auth.user?.id, auth.accessToken], clearCart, { flush: 'sync' })
watch(() => sale.checkout.value?.checkout_id, id => { if (id) clearCart() })

function clearCart() {
  rows.value = []
  promo.value = null
  promotionId.value = null
}
function add(offer: PosOffer) {
  const limits = sale.cartLimits.value
  if (!sale.allowed.value || !limits || sale.saved.value || paying.value || !posCanAddOffer(offer)) return
  const current = rows.value.find(row => row.offer.id === offer.id)
  if (!current && rows.value.length >= limits.max_items) return
  const quantity = (current?.quantity || 0) + 1
  if (quantity > Math.min(offer.available_quantity, limits.max_quantity)) return
  if (current) {
    current.offer = offer
    current.quantity = quantity
  } else rows.value.push({ offer, quantity })
}
function setQuantity(id: number, quantity: number) {
  if (sale.saved.value || paying.value) return
  const index = rows.value.findIndex(row => row.offer.id === id)
  if (index < 0) return
  if (quantity === 0) {
    rows.value.splice(index, 1)
    if (!rows.value.length) setCode(null)
  } else {
    const row = rows.value[index]
    row.quantity = Math.min(quantity, row.offer.available_quantity, sale.cartLimits.value?.max_quantity || 1)
  }
}
function setCode(code: string | null) {
  if (paying.value) return
  promotionId.value = null
  promo.value = code
}
function setPromotion(id: number | null) {
  if (paying.value || (id !== null && !promotions.value.some(option => option.id === id))) return
  promo.value = null
  promotionId.value = id
}
function setOptions(options: PosCartPromotion[] | undefined) {
  if (!Array.isArray(options)) return
  const ids = quantities.value
  promotions.value = options.filter(option => Number.isSafeInteger(option.id) && option.id > 0 && typeof option.name === 'string' && Array.isArray(option.product_ids) && option.product_ids.some(id => ids[id] > 0))
}
watch([request, retry, sale.allowed, sale.saved], ([cart, , allowed, saved], _, onCleanup) => {
  quote.value = null
  quoteBusy.value = false
  quoteError.value = ''
  const itemsKey = JSON.stringify(cart.items)
  if (itemsKey !== quotedItems || !allowed) {
    promotions.value = []
    quotedItems = itemsKey
  }
  if (!cart.items.length || !allowed || saved) return
  quoteBusy.value = true
  let current = true
  const timer = setTimeout(async () => {
    try {
      const result = await sale.getCartQuote(cart)
      if (current) { setOptions(result.available_promotions); quote.value = result }
    } catch (cause) {
      if (!current) return
      const detail = (cause as { data?: { detail?: { code?: string; available_promotions?: PosCartPromotion[] } } })?.data?.detail
      const code = detail?.code
      setOptions(detail?.available_promotions)
      if (code === 'promotion_not_applicable') promotions.value = promotions.value.filter(option => option.id !== cart.promotion_id)
      quoteError.value = code === 'promo_not_applicable' ? 'Цей промокод не діє для кошика. Змініть або приберіть його.'
        : code === 'promotion_not_applicable' ? 'Ця акція більше не підходить. Оберіть іншу або автоматичний розрахунок.'
          : code === 'unsupported_zero_total_pos' ? 'Для оплати mono кожна позиція має коштувати більше нуля. Оберіть іншу акцію.'
            : code === 'out_of_stock' || code === 'product_unavailable' ? 'Змінилися залишки товарів. Перевірте кількість у кошику.'
              : code === 'master_mono_basket_invalid' ? 'У кошику є товар, який mono не може додати до рахунку. Перевірте склад кошика.'
                : 'Не вдалося розрахувати кошик. Спробуйте ще раз.'
    } finally {
      if (current) quoteBusy.value = false
    }
  }, 180)
  onCleanup(() => { current = false; clearTimeout(timer) })
}, { flush: 'sync' })

async function pay() {
  if (!canPay.value || !quote.value) return
  paying.value = true
  try { await sale.startCart(request.value, quote.value, Object.fromEntries(rows.value.map(row => [row.offer.id, row.offer.name]))) }
  finally { paying.value = false }
}
</script>
<template>
  <div class="pos-sale mx-auto max-w-xl space-y-2.5">
    <header class="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div>
        <p class="ui-eyebrow hidden text-xs uppercase tracking-[0.2em] sm:block">Продаж у салоні</p>
        <h1 class="flex items-center gap-2 text-2xl font-semibold sm:mt-1 sm:text-3xl"><ShoppingBagIcon class="h-6 w-6 shrink-0 text-ui-secondary" aria-hidden="true" />Продати товар</h1>
      </div>
      <NuxtLink v-if="sale.capabilities.value?.can_view_admin_sales" to="/admin/product-sales" class="inline-flex min-h-11 items-center text-sm text-ui-secondary underline underline-offset-4">Продажі товарів</NuxtLink>
    </header>
    <BaseCard v-if="sale.loading.value && !sale.checkout.value" padding="sm">
      <BaseLoader inline size="sm" label="Відновлюємо стан продажу" />
    </BaseCard>
    <PosSaleCheckout v-if="sale.checkout.value" :key="sale.checkout.value.checkout_id" :checkout="sale.checkout.value" :payment-url="sale.paymentUrl.value" :can-start="sale.allowed.value" :automatic="sale.capabilities.value?.automatic_reconciliation_enabled === true" :busy="sale.busy.value || sale.loading.value" :can-handover="sale.canHandover.value" :error="sale.error.value" @handover="sale.handover" @refresh="sale.refresh" @recover="sale.recover" @new-sale="sale.startNew" />
    <BaseCard v-else-if="sale.priceQuote.value" as="section" padding="sm" class="space-y-2.5">
      <BaseBadge tone="warning" dot>Потрібне підтвердження</BaseBadge>
      <h2 class="text-lg font-semibold">Розрахунок кошика змінився</h2>
      <p class="text-sm text-ui-secondary">Перевірте нові суми. Рахунок ще не створено.</p>
      <ul class="divide-y divide-ui">
        <li v-for="item in sale.priceQuote.value.items" :key="item.product_id" class="py-2 text-sm">
          <p class="break-words font-medium">{{ sale.saved.value?.itemNames?.[item.product_id] || `Товар #${item.product_id}` }}</p>
          <p class="text-ui-secondary">{{ item.quantity }} шт. × {{ posMoney(item.unit_minor) }} <span v-if="item.discount_source && item.promotion_name">· {{ posDiscountLabels[item.discount_source] }}: {{ item.promotion_name }}</span></p>
        </li>
      </ul>
      <BaseCard variant="subtle" padding="sm">
      <dl class="space-y-2 text-sm tabular-nums">
        <div class="flex justify-between gap-2"><dt>Сума товарів</dt><dd>{{ posMoney(sale.priceQuote.value.subtotal_minor) }}</dd></div>
        <div class="flex justify-between gap-2"><dt>Знижка</dt><dd>{{ posMoney(sale.priceQuote.value.discount_minor) }}</dd></div>
        <div class="flex justify-between gap-2 font-semibold"><dt>До оплати</dt><dd>{{ posMoney(sale.priceQuote.value.amount_minor) }}</dd></div>
      </dl>
      </BaseCard>
      <BaseButton variant="primary" size="lg" block :loading="sale.busy.value" :disabled="!sale.allowed.value" @click="sale.confirmPrice">Погоджуюсь на нову суму</BaseButton>
      <p v-if="sale.error.value" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ sale.error.value }}</p>
    </BaseCard>
    <BaseCard v-else-if="sale.priceOffer.value" class="space-y-4"><BaseBadge tone="warning" dot>Потрібне підтвердження</BaseBadge><h2 class="text-lg font-semibold">Ціна товару змінилася</h2><p class="break-words">{{ sale.priceOffer.value.name }}</p><p class="text-sm text-ui-secondary">Було {{ posMoney(sale.saved.value?.offer?.amount_minor || 0) }}. Рахунок ще не створено.</p><p class="text-2xl font-semibold">Нова ціна: {{ posMoney(sale.priceOffer.value.amount_minor) }}</p><BaseButton variant="primary" size="lg" block :loading="sale.busy.value" :disabled="!sale.allowed.value" @click="sale.confirmPrice">Погоджуюсь на нову ціну</BaseButton><p class="text-xs text-ui-secondary">QR з’явиться лише після вашого підтвердження.</p><p v-if="sale.error.value" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ sale.error.value }}</p></BaseCard>
    <BaseCard v-else-if="sale.saved.value" as="section" class="space-y-3"><h2 class="flex items-center gap-2 text-lg font-semibold"><ArrowPathIcon class="h-5 w-5 text-ui-secondary" aria-hidden="true" />Поточний продаж</h2><BaseLoader v-if="sale.busy.value" label="Готуємо QR цього продажу" /><p v-else role="status" class="text-sm">Продаж збережено. Відновіть його, щоб перевірити той самий рахунок.</p><p v-if="sale.error.value" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ sale.error.value }}</p><BaseButton variant="primary" size="lg" block :loading="sale.busy.value" :disabled="sale.loading.value || !sale.access.value" @click="sale.recover">Відновити цей продаж</BaseButton></BaseCard>
    <template v-else>
      <p v-if="sale.error.value" role="alert" class="ui-status-warning rounded-xl p-3 text-sm">{{ sale.error.value }}</p>
      <BaseCard v-if="!sale.loading.value && !sale.access.value" class="space-y-3"><p role="status" class="text-sm">Продаж через mono зараз недоступний. Зверніться до адміністратора.</p><BaseButton variant="neutral" size="lg" @click="sale.init">Перевірити доступність</BaseButton></BaseCard>
      <p v-if="sale.access.value && !sale.allowed.value" role="status" class="ui-status-warning rounded-xl p-3 text-sm">Нові продажі тимчасово призупинено. Існуючі продажі можна відновити та видати після оплати й чека.</p>
      <PosSaleSearch v-if="sale.access.value" :results="sale.offers.value" :loading="sale.searchBusy.value" :disabled="!sale.access.value || sale.loading.value || sale.busy.value" :can-start="sale.allowed.value && !!sale.cartLimits.value && !paying" :quantities="quantities" :limits="sale.cartLimits.value" :error="sale.searchError.value" @search="sale.search" @select="add" />
      <BaseCard v-if="sale.active.value.items.length" class="space-y-3"><h2 class="flex items-center gap-2 text-lg font-semibold"><ClockIcon class="h-5 w-5 text-ui-secondary" aria-hidden="true" />Незавершені продажі</h2><p class="text-xs text-ui-secondary">Оберіть існуючий продаж для відновлення. Закриття екрана не скасовує його.</p><BaseButton v-for="c in sale.active.value.items" :key="c.checkout_id" variant="neutral" size="lg" block :disabled="!sale.access.value || sale.busy.value" @click="sale.resumeActive(c)">#{{ c.order_id }} · {{ c.items.map(item => item.name).join(', ') }} · {{ posMoney(c.amount_minor) }}</BaseButton></BaseCard>
      <p v-if="sale.allowed.value && !sale.cartLimits.value" role="status" class="ui-status-warning rounded-xl p-3 text-sm">Розрахунок кошика тимчасово недоступний.</p>
      <PosSaleCart v-if="sale.cartLimits.value" :rows="rows" :quote="quote" :promo="promo" :promotion-id="promotionId" :promotions="promotions" :max-quantity="sale.cartLimits.value.max_quantity" :busy="quoteBusy" :paying="paying" :can-pay="canPay" :error="quoteError || sale.error.value" @quantity="setQuantity" @code="setCode" @promotion="setPromotion" @retry="retry++" @pay="pay" />
    </template>
  </div>
</template>
<style scoped>
.pos-sale :deep(input) { font-size: 16px; }
</style>

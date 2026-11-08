<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { ArrowRightIcon, MinusIcon, PhotoIcon, PlusIcon, ShoppingBagIcon, TagIcon, TicketIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import type { PosCartPromotion, PosCartQuote, PosOffer } from '~/types/posSale'
import { posDiscountLabels, posMoney } from '~/composables/usePosSale'

const props = defineProps<{
  rows: { offer: PosOffer; quantity: number }[]
  busy: boolean
  canPay: boolean
  quote: PosCartQuote | null
  promo: string | null
  promotionId: number | null
  promotions: PosCartPromotion[]
  maxQuantity: number
  paying: boolean
  error: string
}>()
const emit = defineEmits<{
  quantity: [id: number, quantity: number]
  code: [value: string | null]
  promotion: [value: number | null]
  retry: []
  pay: []
}>()

const open = ref(false)
const bar = ref<ComponentPublicInstance | null>(null)
const height = ref(0)
const assetUrl = useAssetUrl()
const failedImages = ref<number[]>([])
const count = computed(() => props.rows.reduce((sum, row) => sum + row.quantity, 0))
const promotionInput = ref('')
const quoteLines = computed(() => Object.fromEntries(props.quote?.items.map(item => [item.product_id, item]) || []))
const selection = computed({
  get: () => props.promotionId?.toString() || '',
  set: value => emit('promotion', value ? Number(value) : null),
})
const options = computed(() => [
  { value: '', label: 'Автоматичний розрахунок' },
  ...props.promotions.map(option => ({ value: String(option.id), label: option.name })),
])
const normalizedCode = computed(() => promotionInput.value.trim().toUpperCase())
const canApplyCode = computed(() => /^[A-Z0-9_-]{3,50}$/.test(normalizedCode.value) && normalizedCode.value !== props.promo)
watch(() => props.promo, value => { promotionInput.value = value || '' })
watch(bar, (card, _, onCleanup) => {
  const element = card?.$el
  if (!(element instanceof HTMLElement)) return
  const measure = () => { height.value = element.getBoundingClientRect().height }
  measure()
  const observer = new ResizeObserver(measure)
  observer.observe(element)
  onCleanup(() => observer.disconnect())
}, { flush: 'post' })
watch(count, value => { if (!value) open.value = false })

function changeQuantity(event: MouseEvent, offer: PosOffer, quantity: number) {
  if (quantity <= 1 || quantity >= Math.min(offer.available_quantity, props.maxQuantity)) {
    const button = event.currentTarget
    if (button instanceof HTMLElement) button.closest<HTMLElement>('[role="dialog"]')?.focus()
  }
  emit('quantity', offer.id, quantity)
}
function proceed() {
  if (props.canPay) emit('pay')
  else open.value = true
}
</script>

<template>
  <div v-if="count" aria-hidden="true" :style="{ height: height + 'px' }" />
  <BaseCard
    v-if="count"
    ref="bar"
    as="section"
    variant="elevated"
    padding="none"
    aria-label="Панель кошика"
    class="pos-cart-bar fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl space-y-1.5 !rounded-b-none p-3 backdrop-blur-xl xl:inset-x-auto xl:w-full"
  >
    <div class="flex items-center justify-between gap-2">
      <BaseButton variant="ghost" size="lg" :aria-label="'Відкрити кошик, ' + count + ' шт.'" @click="open = true">
        <ShoppingBagIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>Кошик · {{ count }} шт.</span>
      </BaseButton>
      <span v-if="quote" class="shrink-0 text-sm font-semibold tabular-nums">{{ posMoney(quote.amount_minor) }}</span>
      <BaseLoader v-else-if="busy" inline size="sm" label="Розраховуємо кошик" />
    </div>
    <BaseButton variant="primary" size="lg" block :loading="paying" @click="proceed">
      Перейти до оплати <ArrowRightIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
    </BaseButton>
  </BaseCard>
  <BaseModal v-model="open" aria-label="Кошик" max-width-class="max-w-lg" compact>
    <template #head>
      <div class="flex items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 text-lg font-semibold"><ShoppingBagIcon class="h-5 w-5" aria-hidden="true" />Кошик</h2>
        <ModalCloseButton @click="open = false" />
      </div>
    </template>
    <template #body>
      <div class="pos-cart-body space-y-2.5">
        <ul class="divide-y divide-ui" aria-label="Товари в кошику">
          <li v-for="{ offer, quantity } in rows" :key="offer.id" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 py-1.5">
            <div class="flex min-w-0 items-center gap-1.5">
              <img v-if="offer.image_url && !failedImages.includes(offer.id)" :src="assetUrl(offer.image_url)" alt="" class="h-10 w-10 shrink-0 rounded-lg bg-ui-subtle object-contain" @error="failedImages.push(offer.id)">
              <PhotoIcon v-else class="h-10 w-10 shrink-0 text-ui-muted" aria-hidden="true" />
              <div class="min-w-0 break-words text-sm">
                <p class="font-medium">{{ offer.name }}</p>
                <p v-if="quoteLines[offer.id]?.discount_source && quoteLines[offer.id].promotion_name" class="text-xs text-ui-secondary">
                  {{ posDiscountLabels[quoteLines[offer.id].discount_source!] }}:
                  {{ quoteLines[offer.id].promotion_name }} · −{{ posMoney(quoteLines[offer.id].discount_minor) }}
                </p>
              </div>
            </div>
            <div class="flex flex-col items-end gap-0.5">
              <div class="flex items-center">
              <BaseButton variant="neutral" class="!h-11 !w-11 !p-0" :aria-label="`Зменшити кількість: ${offer.name}`" :disabled="paying || quantity <= 1" @click="changeQuantity($event, offer, quantity - 1)">
                <MinusIcon class="h-5 w-5" aria-hidden="true" />
              </BaseButton>
              <span class="min-w-6 text-center text-sm tabular-nums" :aria-label="`Кількість: ${offer.name}`">{{ quantity }}</span>
              <BaseButton variant="neutral" class="!h-11 !w-11 !p-0" :aria-label="`Збільшити кількість: ${offer.name}`" :disabled="paying || quantity >= Math.min(offer.available_quantity, maxQuantity)" @click="changeQuantity($event, offer, quantity + 1)">
                <PlusIcon class="h-5 w-5" aria-hidden="true" />
              </BaseButton>
              </div>
              <BaseButton variant="danger" class="!h-11 !w-11 !p-0" :aria-label="`Прибрати: ${offer.name}`" :disabled="paying" @click="changeQuantity($event, offer, 0)">
                <TrashIcon class="h-5 w-5" aria-hidden="true" />
              </BaseButton>
            </div>
          </li>
        </ul>
        <BaseSelect
          v-if="promotions.length || promotionId !== null"
          v-model="selection"
          inline-menu
          label="Акція"
          :options="options"
          :disabled="paying || !!promo"
        >
          <template #icon><TagIcon class="h-4 w-4" aria-hidden="true" /></template>
        </BaseSelect>
        <details :open="promo ? true : undefined" class="rounded-xl border border-ui px-2.5">
          <summary class="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium"><TicketIcon class="h-4 w-4 shrink-0 text-ui-secondary" aria-hidden="true" />Промокод<ChevronDownIcon class="ml-auto h-4 w-4" aria-hidden="true" /></summary>
        <form class="space-y-1 pb-2" @submit.prevent="canApplyCode && emit('code', normalizedCode)">
          <BaseInput v-model="promotionInput" label="Промокод" maxlength="50" input-class="base-control px-3 py-3 text-base" autocapitalize="characters" :disabled="paying"><template #icon><TicketIcon class="h-4 w-4" aria-hidden="true" /></template></BaseInput>
          <div class="flex flex-wrap gap-2">
            <BaseButton type="submit" variant="neutral" size="lg" :disabled="!canApplyCode || paying">Застосувати</BaseButton>
            <BaseButton v-if="promo" variant="ghost" size="lg" :disabled="paying" @click="emit('code', null)">Прибрати промокод</BaseButton>
          </div>
        </form>
        </details>
        <BaseLoader v-if="busy" inline size="sm" label="Розраховуємо кошик…" />
        <BaseCard v-if="quote" variant="subtle" padding="none" class="!rounded-xl p-2.5">
          <dl class="space-y-1 text-sm tabular-nums">
            <div class="flex justify-between gap-2"><dt class="text-ui-secondary">Сума товарів</dt><dd>{{ posMoney(quote.subtotal_minor) }}</dd></div>
            <div class="flex justify-between gap-2"><dt class="text-ui-secondary">Знижка</dt><dd>{{ posMoney(quote.discount_minor) }}</dd></div>
            <div class="flex items-baseline justify-between gap-2 border-t border-ui pt-2 font-semibold"><dt>До оплати</dt><dd class="text-lg">{{ posMoney(quote.amount_minor) }}</dd></div>
          </dl>
        </BaseCard>
        <p v-if="error" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ error }}</p>
        <BaseButton v-if="error && !quote" variant="neutral" size="lg" :disabled="busy || paying" @click="emit('retry')">Повторити розрахунок</BaseButton>
        <BaseButton variant="primary" size="lg" block :loading="paying" :disabled="!canPay" @click="emit('pay')">
          Перейти до оплати <ArrowRightIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.pos-cart-bar {
  background: var(--sidebar-bg);
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active) {
  .pos-cart-bar { background: var(--bo-surface); backdrop-filter: none; }
}
@supports not (backdrop-filter: blur(1px)) {
  .pos-cart-bar { background: var(--bo-surface); }
}
.pos-cart-body { padding-bottom: env(safe-area-inset-bottom, 0px); }
@media (width < 1280px) {
  :global(body:has(.backoffice-bottom-nav) .pos-cart-bar) {
    bottom: calc(4rem + env(safe-area-inset-bottom, 0px));
    padding-bottom: 0.75rem;
  }
}
</style>

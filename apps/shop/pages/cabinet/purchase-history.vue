<script setup lang="ts">
import type { PaginatedResponse } from '@shared-types'
import type { CustomerOrder } from '~/types/order'
import FeedbackState from '~/components/ui/FeedbackState.vue'

const PAGE_SIZE = 10
const auth = useCustomerAuthStore()
const api = useApi()
const { dateLocale, terms, locale } = useShopLocale()
const { formatPrice } = useShopPriceFormatter()
const orders = ref<CustomerOrder[]>([])
const historyBlock = ref<HTMLElement | null>(null)
const pagination = reactive({ page: 1, total: 0, pageSize: PAGE_SIZE })
const state = reactive({ loading: false, error: '' })

const pageCount = computed(() => Math.max(1, Math.ceil(pagination.total / pagination.pageSize)))
const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(dateLocale.value, { dateStyle: 'medium' }).format(date)
}

let generation = 0
const sessionIdentity = () => `${auth.customer?.id}:${auth.sessionRevision}:${auth.accessToken}`
const loadOrders = async (nextPage = pagination.page) => {
  if (!auth.isAuthenticated || state.loading) return
  const current = ++generation
  const session = sessionIdentity()
  const isCurrent = () => current === generation && auth.isAuthenticated && session === sessionIdentity()
  state.loading = true
  state.error = ''
  try {
    const response = await api<PaginatedResponse<CustomerOrder>>('/public/orders/me', { query: { page: nextPage, page_size: pagination.pageSize }, retry: 0 })
    if (!isCurrent()) return
    orders.value = response.items || []
    pagination.page = response.page || nextPage
    pagination.total = response.total || 0
    pagination.pageSize = response.page_size || PAGE_SIZE
  }
  catch (error) {
    if (isCurrent()) state.error = terms.value.cabinet.ordersErrorTitle
  }
  finally { if (isCurrent()) state.loading = false }
}
const changePage = async (nextPage: number) => {
  if (state.loading || nextPage === pagination.page || nextPage < 1 || nextPage > pageCount.value) return
  await loadOrders(nextPage)
  if (state.error || pagination.page !== nextPage) return
  await nextTick()
  if (!historyBlock.value) return
  const headerHeight = document.querySelector('.shop-header')?.getBoundingClientRect().height || 0
  window.scrollTo({
    top: Math.max(0, window.scrollY + historyBlock.value.getBoundingClientRect().top - headerHeight - 16),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}

watch(sessionIdentity, () => {
  generation++; orders.value = []; state.loading = false
  pagination.page = 1; pagination.total = 0; state.error = ''
  if (auth.isAuthenticated) void loadOrders(1)
}, { immediate: true })
onBeforeUnmount(() => { generation++ })

useSeo(() => terms.value.cabinet.myOrders, () => terms.value.cabinet.purchaseHistoryDescription)
</script>

<template>
  <CabinetShell>
    <section ref="historyBlock" class="purchase-history" :aria-busy="state.loading">
      <div class="purchase-history__head">
        <h1>{{ terms.cabinet.myOrders }}</h1>
      </div>
      <OrderLoadingSkeleton v-if="state.loading && !orders.length" :label="terms.cabinet.ordersLoading" />
      <FeedbackState v-else-if="state.error" class="purchase-history__feedback" kind="error" :title="terms.cabinet.ordersErrorTitle" :description="terms.cabinet.ordersErrorDescription">
        <BaseButton type="button" :disabled="state.loading" @click="loadOrders()">{{ terms.cabinet.retry }}</BaseButton>
      </FeedbackState>
      <FeedbackState v-else-if="!orders.length" class="purchase-history__feedback" face="sad-droopy-face" :title="terms.cabinet.stillEmpty" :description="terms.cabinet.purchaseHistoryEmpty">
        <BaseButton to="/catalog">{{ terms.cabinet.toGoods }}</BaseButton>
      </FeedbackState>
      <template v-else>
        <ol class="purchase-history__list" :aria-label="terms.cabinet.purchaseHistory">
          <li v-for="order in orders" :key="order.id" class="purchase-history__item">
            <article class="purchase-history__card soft-surface">
              <div class="purchase-history__summary">
                <div class="purchase-history__identity">
                  <div>
                    <p class="purchase-history__eyebrow">{{ terms.cabinet.order }} #{{ order.id }}</p>
                    <h2>{{ formatDate(order.created_at) }}</h2>
                  </div>
                  <BaseBadge tone="dark" class="purchase-history__total"><strong>{{ formatPrice(order.total_amount) }}</strong></BaseBadge>
                </div>
              </div>
              <ul v-if="order.items?.length" class="purchase-history__products" :aria-label="terms.cabinet.items">
                <li v-for="item in order.items.slice(0, 3)" :key="item.id">
                  <NuxtLink class="purchase-history__product-link" :aria-label="item.product_name || `${terms.cabinet.product} #${item.product_id}`" :to="`/products/id/${item.product_id}`">
                  <OrderItemImage :src="item.product_image_url" :name="item.product_name" />
                  <span class="purchase-history__product-name">{{ item.product_name || `${terms.cabinet.product} #${item.product_id}` }}</span>
                  </NuxtLink>
                  <BaseQuantityStepper class="purchase-history__quantity" variant="stacked" :model-value="item.quantity" :min="1" disabled :aria-label="terms.checkout.quantityFor(item.product_name || `${terms.cabinet.product} #${item.product_id}`)" />
                </li>
                <li v-if="order.items.length > 3">+ {{ order.items.length - 3 }}</li>
              </ul>
              <p v-if="order.shipments?.some(shipment => shipment.simulation) || order.payment_status?.startsWith('simulated_') || order.fulfillment_status?.startsWith('simulated_')" class="purchase-history__demo">{{ locale === 'en' ? 'Test data' : 'Тестові дані' }}</p>
              <OrderDates :order="order" />
              <div class="purchase-history__states">
                <OrderProjections class="purchase-history__payment" :order="order" payment-only />
                <div class="purchase-history__delivery" :aria-label="locale === 'en' ? 'Delivery summary' : 'Зведення доставки'"><OrderCustomerStatus class="purchase-history__status" :order="order" carrier-icon /></div>
              <BaseButton class="purchase-history__details" :to="`/cabinet/orders/${order.id}`" variant="text" size="sm">{{ terms.cabinet.viewOrder }} <BaseIcon class="purchase-history__details-arrow" name="arrow-right" size="xxs" /></BaseButton>
              </div>
            </article>
          </li>
        </ol>
        <BasePagination :total="pagination.total" :limit="pagination.pageSize" :offset="(pagination.page - 1) * pagination.pageSize" :disabled="state.loading" :aria-label="terms.cabinet.purchaseHistory" @update:page="changePage" />
      </template>
    </section>
  </CabinetShell>
</template>

<style scoped>
.purchase-history { display: grid; min-width: 0; gap: 1.5rem; }
.purchase-history__head p, .purchase-history__eyebrow { color: #737373; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
.purchase-history__head h1 { margin-top: 0.4rem; font-size: clamp(1.7rem, 4vw, 2rem); font-weight: 800; }
.purchase-history__feedback { min-height: 28rem; }
.purchase-history__list { display: grid; min-width: 0; gap: 0.75rem; }
.purchase-history__item { min-width: 0; }
.purchase-history__card { display: grid; min-width: 0; gap: .65rem; padding: .875rem; color: inherit; text-decoration: none; }
.purchase-history__details:focus-visible { outline: 2px solid #0a0a0a; outline-offset: 2px; }
.purchase-history__summary { display: flex; min-width: 0; flex-wrap: wrap; align-items: start; justify-content: space-between; gap: 0.75rem; }
.purchase-history__identity { width: 100%; justify-content: space-between; display: flex; flex-wrap: wrap; align-items: center; gap: .65rem 1rem; min-width: 0; }
.purchase-history__total { margin-left: auto; background: #0a0a0a; color: #fff; border-color: #0a0a0a; max-width: 100%; flex-wrap: wrap; gap: .35rem .5rem; border-radius: .5rem; padding: .55rem .75rem; text-transform: none; letter-spacing: normal; }
.purchase-history__total strong { font-size: 1rem; font-weight: 800; overflow-wrap: anywhere; }
.purchase-history__summary h2 { margin-top: .15rem; font-size: .85rem; font-weight: 800; }
.purchase-history__products li { display: flex; align-items: center; gap: .6rem; min-width: 0; }
.purchase-history__product-name { min-width: 0; flex: 0 1 auto; overflow-wrap: anywhere; }
.purchase-history__quantity { flex-shrink: 0; }
.purchase-history__products { display: grid; min-width: 0; gap: .3rem; font-size: .85rem; overflow-wrap: anywhere; }
.purchase-history__products :deep(.order-item-image) { width: 48px; height: 48px; flex-basis: 48px; }
.purchase-history__demo { color: #737373; font-size: .7rem; }
.purchase-history__states { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem 1.25rem; }
.purchase-history__payment :deep(div) { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; }
.purchase-history__payment { display: grid; gap: .25rem; font-size: .85rem; overflow-wrap: anywhere; }
.purchase-history__payment :deep(dt) { color: #737373; }
.purchase-history__payment :deep(dd) { font-weight: 700; }
.purchase-history__details { margin-left: auto; justify-self: end; display: inline-flex; width: fit-content; max-width: 100%; align-items: center; gap: 0.45rem; font-size: 0.82rem; font-weight: 800; }
.purchase-history__details :deep(.purchase-history__details-arrow) { width: 14px; height: 14px; flex: 0 0 14px; color: currentColor; transition: transform 432ms cubic-bezier(0.3, 1, 0.3, 1); }
.purchase-history__details:focus-visible :deep(.purchase-history__details-arrow) { transform: rotate(90deg); }
@media (hover: hover) { .purchase-history__details:hover :deep(.purchase-history__details-arrow) { transform: rotate(90deg); } }
@media (prefers-reduced-motion: reduce) { .purchase-history__details :deep(.purchase-history__details-arrow) { transition: none; } }
.purchase-history__product-link { display: flex; align-items: center; gap: .6rem; min-width: 0; flex: 0 1 auto; color: inherit; text-decoration: none; }
.purchase-history__product-link:hover .purchase-history__product-name { text-decoration: underline; text-underline-offset: .2em; }
.purchase-history__product-link:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
</style>

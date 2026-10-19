<script setup lang="ts">
import type { CustomerOrderDto, PaginatedResponse } from '@shared-types'

const auth = useCustomerAuthStore()
const api = useApi()
const { terms, dateLocale } = useShopLocale()
const { formatPrice } = useShopPriceFormatter()
const recentOrders = ref<CustomerOrderDto[]>([])
const orderState = reactive({ loading: false, error: false })

const loadRecentOrders = async () => {
  if (!auth.isAuthenticated) return
  orderState.loading = true
  orderState.error = false
  try {
    const response = await api<PaginatedResponse<CustomerOrderDto>>('/public/orders/me', {
      query: { page: 1, page_size: 3 },
    })
    recentOrders.value = response.items
  }
  catch {
    orderState.error = true
  }
  finally {
    orderState.loading = false
  }
}

watch(() => auth.isAuthenticated, isAuthenticated => {
  if (isAuthenticated) void loadRecentOrders()
  else recentOrders.value = []
}, { immediate: true })

const formatDate = (value: string) => new Intl.DateTimeFormat(dateLocale.value, {
  day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(value))

useSeo(() => terms.value.cabinet.myAccount, () => terms.value.cabinet.accountIntro)
</script>

<template>
  <CabinetShell>
    <main class="cabinet-overview">
      <header class="cabinet-overview__heading">
        <p class="cabinet-overview__eyebrow">{{ terms.common.account }}</p>
        <h1>{{ terms.cabinet.myAccount }}</h1>
        <p>{{ terms.cabinet.accountIntro }}</p>
      </header>

      <section class="cabinet-overview__identity soft-surface" :aria-label="terms.cabinet.personalData">
        <div class="cabinet-overview__identity-copy">
          <h2>{{ auth.displayName }}</h2>
          <p v-if="auth.customer?.email">{{ auth.customer.email }}</p>
          <p v-if="auth.customer?.phone">{{ auth.customer.phone }}</p>
        </div>
        <BaseButton to="/cabinet/settings" variant="outline-dark">{{ terms.cabinet.editProfile }}</BaseButton>
      </section>

      <section class="cabinet-overview__orders soft-surface">
        <div class="cabinet-overview__section-head">
          <h2>{{ terms.cabinet.recentOrders }}</h2>
          <NuxtLink to="/cabinet/purchase-history">{{ terms.cabinet.viewAllOrders }}</NuxtLink>
        </div>
        <p v-if="orderState.loading" class="cabinet-overview__muted" role="status">{{ terms.common.loading }}</p>
        <div v-else-if="orderState.error" class="cabinet-overview__notice" role="alert">
          <span>{{ terms.cabinet.orderLoadingError }}</span>
          <BaseButton size="xs" variant="text" @click="loadRecentOrders">{{ terms.cabinet.retry }}</BaseButton>
        </div>
        <p v-else-if="!recentOrders.length" class="cabinet-overview__muted">{{ terms.cabinet.noRecentOrders }}</p>
        <ul v-else class="cabinet-overview__order-list">
          <li v-for="order in recentOrders" :key="order.id">
            <NuxtLink :to="`/cabinet/orders/${order.id}`">
              <span><strong>#{{ order.id }}</strong><small>{{ formatDate(order.created_at) }}</small></span>
              <span><strong>{{ formatPrice(order.total_amount) }}</strong><small>{{ order.item_count }} {{ terms.cabinet.orderItems.toLowerCase() }}</small></span>
              <BaseIcon name="simple-arrow-right" size="xxs" />
            </NuxtLink>
          </li>
        </ul>
      </section>

    </main>
  </CabinetShell>
</template>

<style scoped>
.cabinet-overview { display: grid; gap: 1.5rem; min-width: 0; }
.cabinet-overview__heading { display: grid; gap: .5rem; }
.cabinet-overview__heading h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); font-weight: 800; line-height: 1.15; }
.cabinet-overview__heading > p:last-child, .cabinet-overview__muted { color: #737373; line-height: 1.6; }
.cabinet-overview__eyebrow { color: #737373; font-size: .72rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.cabinet-overview__identity, .cabinet-overview__orders { display: grid; gap: 1rem; padding: 1rem; }
.cabinet-overview__identity { align-items: center; }
.cabinet-overview__identity-copy { display: grid; gap: .3rem; min-width: 0; }
.cabinet-overview__identity-copy h2 { overflow-wrap: anywhere; font-size: 1.1rem; font-weight: 800; }
.cabinet-overview__identity-copy p { overflow-wrap: anywhere; color: #737373; font-size: .9rem; }
.cabinet-overview__section-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; }
.cabinet-overview__section-head h2 { font-size: 1.1rem; font-weight: 800; }
.cabinet-overview__section-head a, .cabinet-overview__order-list a { color: inherit; }
.cabinet-overview__order-list { display: grid; }
.cabinet-overview__order-list li + li { border-top: 1px solid #ededed; }
.cabinet-overview__order-list a { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: .6rem; padding: .85rem 0; text-decoration: none; }
.cabinet-overview__order-list a > span { display: grid; min-width: 0; gap: .25rem; }
.cabinet-overview__order-list small { overflow-wrap: anywhere; color: #737373; font-size: .75rem; }
.cabinet-overview__notice { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; color: #9f1239; }
@media (min-width: 768px) { .cabinet-overview__identity { grid-template-columns: minmax(0, 1fr) auto; padding: 1.25rem; } .cabinet-overview__orders { padding: 1.25rem; } }
</style>

<script setup lang="ts">
import type { CustomerDirectReturn } from '~/types/order'

const props = defineProps<{ projection: CustomerDirectReturn }>()
const { locale, dateLocale } = useShopLocale()
const copy = {
  uk: {
    title: 'Стан повернення', test: 'Тестові дані', inspection: 'Приймання магазином',
    awaiting_parcel: 'Очікуємо посилку', awaiting_inspection: 'Посилка прибула · очікуємо огляду',
    awaiting_confirmation: 'Прибуття потребує підтвердження', received: 'Огляд завершено', units: 'шт.',
    money: 'Повернення коштів', receipt: 'Чек повернення', partial: 'Часткове повернення', full: 'Повне повернення',
    not_started: 'Ще не розпочато', pending: 'Очікуємо підтвердження', confirmed: 'Підтверджено',
    trackingStale: 'Дані доставки потребують оновлення.', financialStale: 'Дані повернення потребують звірки.',
  },
  en: {
    title: 'Return status', test: 'Test data', inspection: 'Shop inspection',
    awaiting_parcel: 'Awaiting the parcel', awaiting_inspection: 'Parcel arrived · awaiting inspection',
    awaiting_confirmation: 'Arrival needs confirmation', received: 'Inspection complete', units: 'pcs',
    money: 'Refund', receipt: 'Return receipt', partial: 'Partial refund', full: 'Full refund',
    not_started: 'Not started', pending: 'Awaiting confirmation', confirmed: 'Confirmed',
    trackingStale: 'Delivery data needs an update.', financialStale: 'Refund data needs reconciliation.',
  },
} as const
const text = computed(() => copy[locale.value === 'en' ? 'en' : 'uk'])
const amount = computed(() => {
  const value = props.projection.refunded_amount_minor
  return props.projection.money_status === 'confirmed' && props.projection.currency === 'UAH'
    && typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? new Intl.NumberFormat(dateLocale.value, { style: 'currency', currency: 'UAH' }).format(value / 100)
    : ''
})
const quantity = computed(() => {
  const value = props.projection.received_quantity
  return props.projection.inspection_status === 'received' && typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
})
</script>

<template>
  <section v-if="projection.simulation === true" class="order-return-status soft-surface" :aria-label="text.title">
    <header>
      <h2>{{ text.title }}</h2>
      <p class="order-return-status__note">{{ text.test }}</p>
    </header>
    <dl>
      <div>
        <dt>{{ text.inspection }}</dt>
        <dd>{{ text[projection.inspection_status] || text.awaiting_confirmation }}<template v-if="quantity !== null"> · {{ quantity }} {{ text.units }}</template></dd>
      </div>
      <div>
        <dt>{{ text.money }}</dt>
        <dd>{{ text[projection.money_status] || text.pending }}<template v-if="amount"> · {{ amount }}</template>
          <small v-if="projection.refund_kind === 'partial' || projection.refund_kind === 'full'" class="order-return-status__note">{{ text[projection.refund_kind] }}</small>
        </dd>
      </div>
      <div>
        <dt>{{ text.receipt }}</dt>
        <dd>{{ text[projection.return_receipt_status] || text.pending }}</dd>
      </div>
    </dl>
    <p v-if="projection.tracking_stale || projection.financial_stale" class="order-return-status__note">
      {{ [projection.tracking_stale ? text.trackingStale : '', projection.financial_stale ? text.financialStale : ''].filter(Boolean).join(' ') }}
    </p>
  </section>
</template>

<style scoped>
.order-return-status { display: grid; gap: .85rem; padding: 1rem; min-width: 0; }
.order-return-status header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .5rem; }
.order-return-status h2, .order-return-status dd { font-weight: 700; }
.order-return-status dl { display: grid; gap: .65rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); }
.order-return-status dd small { display: block; font-weight: 400; }
.order-return-status dt, .order-return-status__note { color: #525252; font-size: .875rem; }
</style>

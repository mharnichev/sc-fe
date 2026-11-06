<script setup lang="ts">
import { ShoppingBagIcon } from '@heroicons/vue/24/outline'
import PosSaleSearch from '~/components/pos/PosSaleSearch.vue'
import PosSaleCheckout from '~/components/pos/PosSaleCheckout.vue'
import { posMoney } from '~/composables/usePosSale'
const sale = usePosSale()
</script>
<template>
  <div class="pos-sale mx-auto max-w-xl space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-2"><h1 class="flex items-center gap-2 text-2xl font-semibold"><ShoppingBagIcon class="h-6 w-6" aria-hidden="true" />Продати товар</h1><NuxtLink v-if="sale.capabilities.value?.can_view_admin_sales" to="/admin/product-sales" class="inline-flex min-h-11 items-center text-sm text-ui-secondary underline">Продажі товарів</NuxtLink></header>
    <BaseLoader v-if="sale.loading.value" label="Відновлюємо стан продажу" />
    <PosSaleCheckout v-if="sale.checkout.value" :key="sale.checkout.value.checkout_id" :checkout="sale.checkout.value" :payment-url="sale.paymentUrl.value" :can-start="sale.allowed.value" :automatic="sale.capabilities.value?.automatic_reconciliation_enabled === true" :busy="sale.busy.value || sale.loading.value" :can-handover="sale.canHandover.value" :error="sale.error.value" @handover="sale.handover" @refresh="sale.refresh" @recover="sale.recover" @new-sale="sale.startNew" />
    <BaseCard v-else-if="sale.priceOffer.value" class="space-y-4"><h2 class="font-semibold">Ціна товару змінилася</h2><p class="break-words">{{ sale.priceOffer.value.name }}</p><p class="text-sm text-ui-secondary">Було {{ posMoney(sale.saved.value?.body.expected_amount_minor || 0) }}. Рахунок ще не створено.</p><p class="text-2xl font-semibold">Нова ціна: {{ posMoney(sale.priceOffer.value.amount_minor) }}</p><BaseButton variant="primary" size="lg" block :loading="sale.busy.value" :disabled="!sale.allowed.value" @click="sale.confirmPrice">Погоджуюсь на нову ціну</BaseButton><p class="text-xs text-ui-secondary">QR з’явиться лише після вашого підтвердження.</p><p v-if="sale.error.value" role="alert" class="text-sm text-ui-danger">{{ sale.error.value }}</p></BaseCard>
    <BaseCard v-else-if="sale.saved.value" class="space-y-3"><BaseLoader v-if="sale.busy.value" label="Готуємо QR цього продажу" /><p v-else role="status" class="text-sm">Продаж збережено. Відновіть його, щоб перевірити той самий рахунок.</p><p v-if="sale.error.value" role="alert" class="text-sm text-ui-danger">{{ sale.error.value }}</p><BaseButton variant="primary" size="lg" block :loading="sale.busy.value" :disabled="sale.loading.value || !sale.access.value" @click="sale.recover">Відновити цей продаж</BaseButton></BaseCard>
    <template v-else>
      <p v-if="sale.error.value" role="alert" class="ui-status-warning rounded-xl p-3 text-sm">{{ sale.error.value }}</p>
      <BaseCard v-if="!sale.loading.value && !sale.access.value" class="space-y-3"><p role="status" class="text-sm">Продаж через mono зараз недоступний. Зверніться до адміністратора.</p><BaseButton variant="neutral" size="lg" @click="sale.init">Перевірити доступність</BaseButton></BaseCard>
      <p v-if="sale.access.value && !sale.allowed.value" role="status" class="ui-status-warning rounded-xl p-3 text-sm">Нові продажі тимчасово призупинено. Існуючі продажі можна відновити та видати після оплати й чека.</p>
      <PosSaleSearch v-if="sale.access.value" :results="sale.offers.value" :loading="sale.searchBusy.value" :disabled="!sale.access.value || sale.loading.value || sale.busy.value" :can-start="sale.allowed.value" :error="sale.searchError.value" @search="sale.search" @select="sale.selectOffer" />
      <BaseCard v-if="sale.active.value.items.length" class="space-y-3"><h2 class="font-semibold">Незавершені продажі</h2><p class="text-xs text-ui-secondary">Оберіть існуючий продаж для відновлення. Закриття екрана не скасовує його.</p><BaseButton v-for="c in sale.active.value.items" :key="c.checkout_id" variant="neutral" size="lg" block :disabled="!sale.access.value || sale.busy.value" @click="sale.resumeActive(c)">#{{ c.order_id }} · {{ c.items.map(item => item.name).join(', ') }} · {{ posMoney(c.amount_minor) }}</BaseButton></BaseCard>
    </template>
  </div>
</template>
<style scoped>
.pos-sale :deep(input) { font-size: 16px; }
</style>

<script setup lang="ts">
import { CheckCircleIcon, PhotoIcon, ArrowPathIcon, DocumentTextIcon, QrCodeIcon, ShoppingBagIcon, CreditCardIcon, ReceiptPercentIcon } from '@heroicons/vue/24/outline'
import type { PosCheckout } from '~/types/posSale'
import { posMoney } from '~/composables/usePosSale'
import { qrMockCode } from '~/utils/qrMock'
const props = defineProps<{ checkout: PosCheckout; paymentUrl: string | null; automatic: boolean; canStart: boolean; busy: boolean; canHandover: boolean; error: string }>()
const paymentLabels: Record<PosCheckout['payment']['status'], string> = {
  not_started: 'Не розпочато', pending: 'Очікує оплати', processing: 'Обробляється',
  paid: 'Підтверджена', failed: 'Помилка оплати', expired: 'Рахунок прострочено',
  reversed: 'Платіж повернено', unknown: 'Стан не підтверджено',
}
const receiptLabels: Record<PosCheckout['receipt']['status'], string> = {
  not_requested: 'Ще не запитано', pending: 'Очікує Checkbox', accepted: 'Готовий',
  failed: 'Помилка Checkbox', requires_review: 'Потребує перевірки',
}
const paymentTone = computed(() => props.checkout.payment.status === 'paid' ? 'success'
  : ['unknown', 'failed', 'expired', 'reversed'].includes(props.checkout.payment.status) ? 'warning' : 'info')
const receiptTone = computed(() => props.checkout.receipt.status === 'accepted' ? 'success'
  : ['failed', 'requires_review'].includes(props.checkout.receipt.status) ? 'warning'
    : props.checkout.receipt.status === 'pending' ? 'info' : 'neutral')
const emit = defineEmits<{ handover: []; refresh: []; recover: []; newSale: [] }>()
const assetUrl = useAssetUrl(), api = useApi(), auth = useAuthStore()
const code = computed(() => props.paymentUrl ? qrMockCode(props.paymentUrl) : null)
const failedImages = ref<number[]>([]), printBusy = ref(false), printError = ref('')
let printGeneration = 0
const blobs = new Set<string>(), popups = new Set<Window>()
watch(() => [props.checkout.checkout_id, auth.user?.id, auth.accessToken], () => { printGeneration++; popups.forEach(p => p.close()); popups.clear(); blobs.forEach(url => URL.revokeObjectURL(url)); blobs.clear(); printBusy.value = false; printError.value = '' }, { flush: 'sync' })
onScopeDispose(() => { printGeneration++; popups.forEach(p => p.close()); blobs.forEach(url => URL.revokeObjectURL(url)) })
const canPrint = computed(() => !props.error && !!auth.user?.is_active && !!auth.accessToken && props.checkout.payment.status === 'paid' && props.checkout.receipt.status === 'accepted' && props.checkout.receipt.pdf_url === `/api/v1/backoffice/master-mono/orders/${props.checkout.order_id}/receipt/pdf`)
const print = async () => {
  if (!canPrint.value || printBusy.value) return
  const generation = printGeneration, orderId = props.checkout.order_id
  const popup = window.open('about:blank', '_blank')
  if (!popup) { printError.value = 'Дозвольте відкриття вікна чека.'; return }
  popup.opener = null; popups.add(popup); printBusy.value = true; printError.value = ''
  try {
    const blob = await api<Blob>(`/backoffice/master-mono/orders/${orderId}/receipt/pdf`, { responseType: 'blob', retry: 0, cache: 'no-store' })
    if (generation !== printGeneration) { popup.close(); return }
    if (!(blob instanceof Blob) || blob.type.split(';')[0] !== 'application/pdf') throw new Error('invalid receipt')
    const url = URL.createObjectURL(blob); blobs.add(url); popup.location.replace(url)
  } catch { popup.close(); if (generation === printGeneration) printError.value = 'Чек поки недоступний. Спробуйте пізніше.' }
  finally { if (generation === printGeneration) printBusy.value = false }
}
</script>
<template>
  <BaseCard as="section" padding="sm" class="space-y-2.5" aria-label="Поточний продаж">
    <header class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p class="ui-eyebrow text-xs uppercase tracking-[0.16em]">Поточний продаж</p>
        <h2 class="mt-1 text-lg font-semibold">{{ code ? 'Оплата через mono' : 'Стан продажу' }}</h2>
      </div>
      <BaseBadge v-if="code" tone="accent"><QrCodeIcon class="h-4 w-4" aria-hidden="true" />Mono QR</BaseBadge>
    </header>
    <p class="text-center text-3xl font-semibold tabular-nums">{{ posMoney(checkout.amount_minor) }}</p>
    <!-- QR is machine-readable content: fixed black modules on a white quiet zone, independent of UI theme. -->
    <figure v-if="code" class="mx-auto w-fit max-w-full text-center">
      <svg role="img" aria-label="QR для оплати mono" :viewBox="`0 0 ${code.size} ${code.size}`" class="pos-sale-qr block h-64 w-64 max-w-full rounded-lg" shape-rendering="crispEdges">
        <rect width="100%" height="100%" fill="white" /><path :d="code.path" fill="black" />
      </svg>
      <figcaption class="mt-3 text-sm text-ui-secondary">Клієнт сканує QR і сплачує через mono</figcaption>
    </figure>
    <dl class="grid grid-cols-2 gap-2">
      <BaseCard variant="subtle" padding="sm" class="min-w-0 !rounded-xl">
        <dt class="mb-1 flex items-center gap-1 text-xs text-ui-secondary"><CreditCardIcon class="h-4 w-4" aria-hidden="true" />Оплата</dt>
        <dd><BaseBadge :tone="paymentTone" class="max-w-full !whitespace-normal">{{ paymentLabels[checkout.payment.status] || 'Стан не підтверджено' }}</BaseBadge></dd>
      </BaseCard>
      <BaseCard variant="subtle" padding="sm" class="min-w-0 !rounded-xl">
        <dt class="mb-1 flex items-center gap-1 text-xs text-ui-secondary"><ReceiptPercentIcon class="h-4 w-4 shrink-0" aria-hidden="true" />Чек Checkbox</dt>
        <dd><BaseBadge :tone="receiptTone" class="max-w-full !whitespace-normal">{{ receiptLabels[checkout.receipt.status] || 'Стан не підтверджено' }}</BaseBadge></dd>
      </BaseCard>
    </dl>
    <p v-if="checkout.status === 'completed' && checkout.handover.status === 'handed_over'" role="status" class="flex items-center justify-center gap-2 font-semibold text-ui-success"><CheckCircleIcon class="h-6 w-6" aria-hidden="true" />Продаж завершено. Товар видано.</p>
    <p v-else-if="checkout.payment.status === 'paid' && checkout.receipt.status !== 'accepted'" role="status" class="ui-status-info rounded-xl p-3 text-sm">Оплату підтверджено. {{ checkout.receipt.status === 'failed' || checkout.receipt.status === 'requires_review' ? 'Чек потребує перевірки адміністратора.' : 'Очікуємо чек.' }} Повторно платити не потрібно. Видача поки недоступна.</p>
    <p v-else-if="checkout.status === 'requires_review' || ['unknown','failed','expired','reversed'].includes(checkout.payment.status)" role="status" class="ui-status-warning rounded-xl p-3 text-sm">Потрібна перевірка адміністратора. Не створюйте нову оплату. Цей продаж і його резерв збережені.</p>
    <p v-else-if="canHandover" role="status" class="text-center font-medium">Оплату та чек підтверджено. Передайте товар клієнту.</p>
    <p v-else role="status" class="text-center text-sm text-ui-secondary">{{ code ? 'Очікуємо підтвердження оплати…' : 'Перевіряємо стан цього самого продажу…' }}</p>
    <BaseButton v-if="canHandover" variant="primary" size="lg" block :loading="busy" @click="emit('handover')">Товар видано</BaseButton>
    <BaseButton v-if="canStart && checkout.status === 'completed' && checkout.handover.status === 'handed_over' && checkout.actions.can_start_new" variant="primary" size="lg" block :disabled="busy" @click="emit('newSale')">Новий продаж</BaseButton>
    <p v-if="error" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ error }}</p>
    <div class="flex flex-wrap justify-center gap-2"><BaseButton v-if="error" variant="neutral" size="lg" :loading="busy" @click="emit('recover')">Відновити цей продаж</BaseButton><BaseButton v-else-if="checkout.actions.can_refresh && checkout.status !== 'completed' && (!automatic || checkout.status === 'requires_review')" variant="ghost" size="lg" :loading="busy" @click="emit('refresh')"><ArrowPathIcon class="h-4 w-4" aria-hidden="true" />Оновити стан</BaseButton><BaseButton v-if="canPrint && checkout.status === 'completed'" variant="neutral" size="lg" :loading="printBusy" @click="print"><DocumentTextIcon class="h-5 w-5" aria-hidden="true" />Відкрити чек</BaseButton></div>
    <p v-if="printError" role="alert" class="ui-status-danger rounded-xl p-3 text-sm">{{ printError }}</p>
    <section class="space-y-2 border-t border-ui pt-3" aria-label="Товари продажу">
      <h3 class="flex items-center gap-2 text-sm font-semibold"><ShoppingBagIcon class="h-4 w-4 text-ui-secondary" aria-hidden="true" />Товари</h3>
      <ul class="divide-y divide-ui">
        <li v-for="(item, index) in checkout.items" :key="index" class="flex items-center gap-3 py-2">
          <img v-if="item.image_url && !failedImages.includes(item.product_id)" :src="assetUrl(item.image_url)" alt="" class="h-10 w-10 shrink-0 rounded-lg bg-ui-subtle object-contain" @error="failedImages.push(item.product_id)">
          <PhotoIcon v-else class="h-10 w-10 shrink-0 text-ui-muted" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="break-words text-sm font-medium">{{ item.name }}</p>
            <p class="text-xs text-ui-secondary">{{ item.variant_label ? `${item.variant_label} · ` : '' }}{{ item.quantity }} шт.</p>
          </div>
          <p class="shrink-0 text-sm tabular-nums">{{ posMoney(item.total_minor) }}</p>
        </li>
      </ul>
    </section>
  </BaseCard>
</template>

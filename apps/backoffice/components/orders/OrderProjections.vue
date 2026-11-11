<script setup lang="ts">
import { ChevronDownIcon, CreditCardIcon, DocumentTextIcon, TruckIcon } from '@heroicons/vue/24/outline'
import type { OrderProjections } from '~/composables/useBackofficeApi'
const props = defineProps<{ order: OrderProjections, compact?: boolean }>()
const labels: Record<string, string> = {
  mono_checkbox_external_accepted: 'Чек mono → Checkbox підтверджено',
  simulated_mono_checkbox_external_accepted: 'Тестовий чек mono → Checkbox підтверджено',
  paid_production: 'Оплачено',
  payment_reconciliation_required: 'Потрібна звірка оплати',
  pickup_handed_over: 'Видано',
  carrier_dispatched: 'Передано перевізнику',
  fulfilled: 'Виконано',
  simulated_pickup_handed_over: 'Тестова видача',
  simulated_carrier_dispatched: 'Тестова передача перевізнику',
  simulated_fulfilled: 'Тестове виконання',
  mono_checkbox_external_receipt_pending: 'Очікує підтвердження чека',
  mono_checkbox_external_pending_document: 'Чек ще недоступний',
  paid_provider: 'Оплачено',
  paid_manual: 'Оплату підтверджено вручну',
  mono_checkbox_external_payment_reconciliation_required: 'Потрібна звірка оплати та чека',
  simulated_mono_checkbox_external_receipt_pending: 'Очікуємо тестовий чек mono → Checkbox',
  simulated_mono_checkbox_external_payment_reconciliation_required: 'Потрібна звірка тестової оплати та чека',
  master_mono_receipt_accepted: 'Чек mono → Checkbox підтверджено',
  master_mono_receipt_pending: 'Очікуємо підтвердження чека mono → Checkbox',
  master_mono_pdf_available: 'PDF-чек доступний',
  master_mono_pdf_pending: 'PDF-чек ще недоступний',
  simulated_master_mono_receipt_accepted: 'Тестовий чек mono → Checkbox підтверджено',
  simulated_master_mono_receipt_pending: 'Очікуємо підтвердження тестового чека mono → Checkbox',
  simulated_master_mono_pdf_available: 'Тестовий PDF-чек доступний',
  simulated_master_mono_pdf_pending: 'Тестовий PDF-чек ще недоступний',
  refunded: "Гроші повернено; оплачене скасування завершено",
  financial_exception: "Фінансова невідповідність: потрібна окрема звірка грошей",
  cancelled_before_handover: "Скасовано до видачі або відправлення; товар не передавався",
  cancellation_pending: "Скасування або звірка до передачі не завершені; резерв утримується",
  simulated_refunded: "Тест: Гроші повернено; оплачене скасування завершено",
  simulated_financial_exception: "Тест: Фінансова невідповідність: потрібна окрема звірка грошей",
  simulated_cancelled_before_handover: "Тест: Скасовано до видачі або відправлення; товар не передавався",
  simulated_cancellation_pending: "Тест: Скасування або звірка до передачі не завершені; резерв утримується",

  np_return_pending: "Повернення НП ще не завершено",
  np_return_received: "Посилку НП прийнято після окремого огляду",
  np_return_fiscalized: "Повернення НП підтверджено чеком повернення",
  np_refusal_closed: "Неоплачену відмову НП закрито без платежу",
  simulated_np_return_pending: "Тест: Повернення НП ще не завершено",
  simulated_np_return_received: "Тест: Посилку НП прийнято після окремого огляду",
  simulated_np_return_fiscalized: "Тест: Повернення НП підтверджено чеком повернення · до ДПС не надсилалось",
  simulated_np_refusal_closed: "Тест: Неоплачену відмову НП закрито без платежу",

  checkbox_fiscal_queued: "Чек Checkbox у черзі — ще не видано",
  checkbox_fiscal_unknown: "Результат Checkbox невідомий — потрібна звірка",
  checkbox_fiscal_pending: "Checkbox очікує остаточне підтвердження — ще не видано",
  checkbox_fiscal_rejected: "Checkbox відхилив чек — видачу не підтверджено",
  checkbox_fiscal_cancelled: "Непередане погодження Checkbox скасовано",
  checkbox_fiscal_invalid: "Доказ Checkbox недійсний — видачу не підтверджено",
  checkbox_fiscal_issued: "Видачу чека Checkbox підтверджено",
  checkbox_fiscal_return_pending: "Повернення чека Checkbox очікує завершення",
  checkbox_fiscal_partial_return: "Часткове повернення підтверджено чеком Checkbox",
  checkbox_fiscal_returned: "Повне повернення підтверджено чеком Checkbox",
  simulated_checkbox_fiscal_queued: "Тест: Чек Checkbox у черзі — ще не видано · до ДПС не надсилалось",
  simulated_checkbox_fiscal_unknown: "Тест: Результат Checkbox невідомий — потрібна звірка · до ДПС не надсилалось",
  simulated_checkbox_fiscal_pending: "Тест: Checkbox очікує остаточне підтвердження — ще не видано · до ДПС не надсилалось",
  simulated_checkbox_fiscal_rejected: "Тест: Checkbox відхилив чек — видачу не підтверджено · до ДПС не надсилалось",
  simulated_checkbox_fiscal_cancelled: "Тест: Непередане погодження Checkbox скасовано · до ДПС не надсилалось",
  simulated_checkbox_fiscal_invalid: "Тест: Доказ Checkbox недійсний — видачу не підтверджено · до ДПС не надсилалось",
  simulated_checkbox_fiscal_issued: "Тест: Видачу чека Checkbox підтверджено · до ДПС не надсилалось",
  simulated_checkbox_fiscal_return_pending: "Тест: Повернення чека Checkbox очікує завершення · до ДПС не надсилалось",
  simulated_checkbox_fiscal_partial_return: "Тест: Часткове повернення підтверджено чеком Checkbox · до ДПС не надсилалось",
  simulated_checkbox_fiscal_returned: "Тест: Повне повернення підтверджено чеком Checkbox · до ДПС не надсилалось",
  checkbox_pending_document: "Локальна копія Checkbox ще недоступна; надсилання покупцю не підтверджено",
  checkbox_local_print_available: "Локальна копія Checkbox доступна співробітнику; надсилання покупцю не підтверджено",
  simulated_checkbox_pending_document: "Тест: Локальна копія Checkbox ще недоступна; надсилання покупцю не підтверджено",
  simulated_checkbox_local_print_available: "Тест: Локальна копія Checkbox доступна співробітнику; надсилання покупцю не підтверджено",

  simulated_carrier_return_unknown: 'Тестове повернення НП: результат створення невідомий; зворотну ТТН не підтверджено',
  simulated_carrier_returning: 'Тест: зворотна посилка в дорозі',
  simulated_carrier_returned: 'Тест: перевізник повернув посилку — склад ще не змінено',
  simulated_carrier_return_received: 'Тест: зворотну посилку прийнято окремо',
  simulated_unpaid_refusal_closed: 'Тест: неоплачену відмову закрито без платежу',

  simulated_fiscal_queued: 'Тестовий чек у черзі — ще не видано',
  simulated_fiscal_unknown: 'Результат тестового чека невідомий — потрібна звірка',
  simulated_fiscal_issued: 'Видано тестовий чек — до ДПС не надсилалось',
  simulated_fiscal_cancelled: 'Погодження тестового чека скасовано',
  simulated_fiscal_error: 'Помилка тестового чека — видачу не підтверджено',
  simulated_fiscal_invalid: 'Підтвердження тестового чека недійсне',
  simulated_fiscal_return_pending: 'Тестове повернення чека очікує завершення',
  simulated_fiscal_partial_return: 'Часткове повернення підтверджено тестовим чеком',
  simulated_fiscal_returned: 'Повне повернення підтверджено тестовим чеком',
  simulated_pending_document: 'Тестовий документ для локального друку ще відсутній',
  simulated_local_print_available: 'Тестовий чек доступний для локального перегляду / друку',
  simulated_paid: 'Тестова оплата (симуляція)', simulated_handed_over: 'Тестова видача (симуляція)', paid: 'Оплачено', handed_over: 'Видано',
  failed: 'Помилка оплати', unpaid: 'Не оплачено', legacy_unknown: 'Історичні дані: немає підтвердження',
  reserved: 'Зарезервовано', unfulfilled: 'Очікує виконання', cancelled: 'Скасовано',
  not_requested: 'Не запитувалась', pending_document: 'Фіскальний документ відсутній',
}
const failureReasons: Record<string, string> = {
  merchant_readiness_failed: 'mono не готовий до створення рахунку.',
  invoice_pre_dispatch_failed: 'Не виконано умови для надсилання рахунку.',
  payment_page_unverified: 'Сторінку оплати не підтверджено.',
  invoice_response_invalid: 'Не вдалося перевірити відповідь mono.',
  invoice_binding_unconfirmed: 'Зв’язок рахунку із замовленням не підтверджено.',
  invoice_result_unconfirmed: 'Результат запиту на створення рахунку невідомий.',
  invoice_binding_missing: 'Відсутній зв’язок рахунку із замовленням.',
  invoice_id_missing: 'Ідентифікатор рахунку відсутній.',
}
const missingLabels: Record<string, string> = {
  merchant_readiness: 'готовність приймання оплат',
  dispatch_preconditions: 'умови надсилання рахунку',
  invoice_id: 'ідентифікатор рахунку',
  bank_dispatch_result: 'результат надсилання до mono',
  payment_page_url: 'сторінка оплати',
  verified_invoice_binding: 'зв’язок рахунку із замовленням',
  verified_invoice_response: 'перевірена відповідь mono',
  payment_intent: 'платіжний запис',
}
const failure = computed(() => props.order.payment_status === 'failed' ? props.order.payment_failure : null)
const missing = computed(() => failure.value?.missing.map(code => missingLabels[code] || 'дані оплати').join(', '))
const label = (value?: string) => labels[value || 'legacy_unknown'] || value
const rows = computed(() => [
  ['Оплата', label(props.order.payment_status)], ['Виконання', label(props.order.fulfillment_status)],
  ['Фіскалізація', label(props.order.fiscal_status)], ['Доставка чека', label(props.order.receipt_delivery_status)],
])
const needsAttention = computed(() => [props.order.fiscal_status, props.order.receipt_delivery_status]
  .some(value => /unknown|rejected|invalid|error|exception/.test(value || '')))
const receiptId = useId()
const receiptOpen = ref(needsAttention.value)
watch(needsAttention, value => { receiptOpen.value = value })
</script>
<template>
  <div v-if="compact" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 sm:gap-x-4">
    <dl class="grid grid-cols-[minmax(0,4fr)_minmax(0,5fr)] gap-x-2 py-0.5 min-[360px]:grid-cols-2 sm:gap-x-3">
      <div v-for="([title, value], index) in rows.slice(0, 2)" :key="title" class="min-w-0 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-2">
        <dt class="flex items-center gap-1 text-xs text-ui-secondary">
          <component :is="index === 0 ? CreditCardIcon : TruckIcon" class="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
          {{ title }}
        </dt>
        <dd class="break-words text-xs font-medium leading-tight text-ui-primary sm:text-sm">{{ value }}</dd>
      </div>
    </dl>
    <BaseButton
      variant="unstyled"
      type="button"
      class="flex min-h-11 items-center gap-1 rounded-md px-1 text-xs text-ui-secondary hover:bg-ui-subtle focus-visible:outline focus-visible:outline-2 sm:gap-2 sm:px-2"
      :aria-controls="receiptId"
      :aria-expanded="receiptOpen"
      @click="receiptOpen = !receiptOpen"
    >
      <DocumentTextIcon class="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
      <span>Чек<span class="sr-only sm:not-sr-only"> та фіскалізація</span></span>
      <span v-if="needsAttention" class="font-semibold text-ui-primary"><span aria-hidden="true">!</span><span class="sr-only">Потребує уваги</span></span>
      <ChevronDownIcon class="h-3 w-3 shrink-0 sm:h-4 sm:w-4" :class="{ 'rotate-180': receiptOpen }" aria-hidden="true" />
    </BaseButton>
    <dl v-show="receiptOpen" :id="receiptId" class="col-span-2 grid grid-cols-2 gap-2 border-t border-ui py-2">
      <div v-for="[title, value] in rows.slice(2)" :key="title" class="min-w-0 text-xs">
        <dt class="text-ui-secondary">{{ title }}</dt>
        <dd class="mt-0.5 break-words font-medium text-ui-primary">{{ value }}</dd>
      </div>
    </dl>
  </div>
  <dl v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div v-for="[title, value] in rows" :key="title"><dt class="text-sm text-ui-secondary">{{ title }}</dt><dd class="mt-1 font-medium text-ui-primary">{{ value }}</dd></div></dl>
  <div v-if="compact && failure" class="ui-status-warning mt-3 rounded-xl px-3 py-2 text-sm" role="status">
    <p class="font-medium">{{ failureReasons[failure.code] || 'Не вдалося підготувати оплату.' }}</p>
    <p v-if="missing">Перевірити: {{ missing }}.</p>
    <p v-if="failure.reconciliation_required">Потрібна звірка оплати.</p>
  </div>
</template>

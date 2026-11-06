<script setup lang="ts">
import type { MonthlyDiscountItem, MonthlyDiscountWarning } from '~/utils/monthlyDiscounts'

const auth = useAuthStore()
const api = useBackofficeApi()
const { todayInput, formatDate, formatDateTime, formatMoney } = useBookingFormatting()
const isSuperuser = computed(() => auth.user?.is_superuser === true)
const today = todayInput()
const year = ref(Number(today.slice(0, 4)))
const month = ref(Number(today.slice(5, 7)))
const offset = ref(0)
const limit = 50
const monthFormatter = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', month: 'long' })
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: monthFormatter.format(new Date(Date.UTC(2000, index, 1, 12))),
}))
const yearOptions = Array.from({ length: 101 }, (_, index) => ({ value: 2100 - index, label: String(2100 - index) }))
const periodLabel = computed(() => [
  formatDate(new Date(Date.UTC(year.value, month.value - 1, 1, 12)).toISOString()),
  formatDate(new Date(Date.UTC(year.value, month.value, 0, 12)).toISOString()),
].join(' — '))
const updateMonth = (value: unknown) => {
  month.value = Number(value)
  offset.value = 0
}
const updateYear = (value: unknown) => {
  year.value = Number(value)
  offset.value = 0
}
const requestKey = computed(() => ['monthly-service-discounts', auth.user?.id, isSuperuser.value, year.value, month.value, offset.value].join(':'))
const { data, pending, error, refresh } = useAsyncData(
  requestKey,
  () => api.adminGetMonthlyDiscounts({ year: year.value, month: month.value, offset: offset.value, limit }),
  { immediate: isSuperuser.value },
)
const errorStatus = computed(() => {
  const cause = error.value as { statusCode?: number, status?: number, response?: { status?: number } } | null
  return cause?.response?.status ?? cause?.statusCode ?? cause?.status
})
const errorMessage = computed(() => {
  if (errorStatus.value === 401) return 'Сесія завершилася. Увійдіть знову, щоб переглянути звіт.'
  if (errorStatus.value === 403) return 'Для перегляду цього звіту потрібні права суперкористувача.'
  if (errorStatus.value === 422) return 'Не вдалося застосувати період. Перевірте вибраний місяць і рік.'
  if ([404, 405, 501].includes(errorStatus.value || 0)) return 'Звіт про знижки тимчасово недоступний.'
  return 'Не вдалося завантажити звіт про знижки. Спробуйте ще раз.'
})
const moneyLabel = (value: string | null) => value === null ? 'Невідомо' : formatMoney(value)
const promotionLabel = (row: MonthlyDiscountItem) =>
  row.promotion_name_uk || row.promotion_name_en || row.promotion_code
  || (row.campaign_offer_id ? 'Персональна пропозиція' : row.promotion_application_mode_snapshot === 'automatic' ? 'Автоматична акція' : '—')
const warningLabels: Record<MonthlyDiscountWarning, string> = {
  missing_pricing_snapshot: 'Частину сум не збережено.',
  invalid_pricing_snapshot: 'Збережені суми некоректні.',
  discount_exceeds_subtotal: 'Знижка перевищує суму до знижки.',
  snapshot_total_mismatch: 'Підсумок не узгоджується зі збереженими сумами.',
}
defineExpose({ refresh })
</script>

<template>
  <section v-if="isSuperuser" class="monthly-discounts" aria-labelledby="monthly-discounts-title" :aria-busy="pending || undefined">
    <div class="monthly-discounts__header">
      <div>
        <h2 id="monthly-discounts-title" class="text-lg font-semibold text-ui-primary">Використані знижки за місяць</h2>
        <p class="mt-1 text-sm text-ui-secondary">{{ periodLabel }} · Europe/Kyiv · за датою початку завершеного візиту</p>
        <p class="mt-1 text-xs text-ui-muted">Усі майстри. Верхні фільтри періоду й майстра не впливають на цей звіт.</p>
      </div>
      <BaseButton type="button" variant="neutral" size="sm" :loading="pending" @click="refresh">Оновити звіт</BaseButton>
    </div>

    <div class="monthly-discounts__filters" aria-label="Місяць звіту про знижки">
      <BaseSelect :model-value="month" :options="monthOptions" label="Місяць" @update:model-value="updateMonth" />
      <BaseSelect :model-value="year" :options="yearOptions" label="Рік" @update:model-value="updateYear" />
    </div>

    <p class="monthly-discounts__history text-xs text-ui-muted">Архівні візити не враховані. Повноту історичних знижок перевірити неможливо: частина старих цін могла не зберегтися.</p>

    <div v-if="error" class="monthly-discounts__error" role="alert">
      <p>{{ errorMessage }}</p>
      <BaseButton type="button" variant="neutral" size="sm" class="mt-3" @click="refresh">Повторити</BaseButton>
    </div>
    <template v-else>
      <dl v-if="data && !pending" class="monthly-discounts__totals">
        <div><dt>Завершених візитів</dt><dd>{{ data.summary.completed_bookings.toLocaleString('uk-UA') }}</dd></div>
        <div><dt>З відомою знижкою</dt><dd>{{ data.summary.discounted_bookings.toLocaleString('uk-UA') }}</dd></div>
        <div><dt>Невідомі суми</dt><dd>{{ data.summary.unknown_discount_bookings.toLocaleString('uk-UA') }}</dd></div>
        <div><dt>Некоректні суми</dt><dd>{{ data.summary.invalid_discount_bookings.toLocaleString('uk-UA') }}</dd></div>
        <div><dt>Відома сума знижок</dt><dd>{{ formatMoney(data.summary.known_discount_amount) }}</dd></div>
      </dl>
      <p v-if="data && !pending" class="mb-3 text-xs text-ui-muted">Підсумки за весь місяць. Невідомі та некоректні компоненти знижки не замінюються нулями.</p>

      <BaseTable
        dense
        caption="Знижки на завершені візити за вибраний місяць"
        min-width="64rem"
        :loading="pending"
        :empty="Boolean(data && !data.items.length)"
        :empty-title="offset ? 'На цій сторінці немає візитів' : 'У вибраному місяці використаних знижок немає'"
        empty-description="Оберіть інший місяць або оновіть звіт."
      >
        <template #head>
          <tr><th>Візит</th><th>Клієнт</th><th>Майстер</th><th>Акція</th><th>До знижки</th><th>Знижка</th><th>Після знижки</th></tr>
        </template>
        <tr v-for="row in data?.items || []" :key="row.booking_id">
          <td class="whitespace-nowrap"><span class="block">{{ formatDateTime(row.start_at) }}</span><span class="text-xs text-ui-muted">#{{ row.booking_id }}</span></td>
          <td><span class="monthly-discounts__name block font-medium text-ui-primary">{{ row.customer_name || 'Без імені' }}</span><span v-if="row.customer_phone" class="block whitespace-nowrap text-xs text-ui-muted">{{ row.customer_phone }}</span></td>
          <td><span class="monthly-discounts__name">{{ row.master_name || `Майстер #${row.master_id}` }}</span></td>
          <td>
            <span class="monthly-discounts__name block">{{ promotionLabel(row) }}</span>
            <span v-if="row.promotion_code && row.promotion_code !== promotionLabel(row)" class="monthly-discounts__name block text-xs text-ui-muted">{{ row.promotion_code }}</span>
            <span v-if="row.promotion_discount_percent !== null" class="block text-xs text-ui-muted">{{ row.promotion_discount_percent }}%</span>
          </td>
          <td class="monthly-discounts__money">{{ moneyLabel(row.subtotal_amount) }}</td>
          <td>
            <span class="monthly-discounts__money block font-semibold">{{ moneyLabel(row.discount_amount) }}</span>
            <span class="block whitespace-nowrap text-xs text-ui-muted">Акція: {{ moneyLabel(row.promotion_discount_amount) }}</span>
            <span class="block whitespace-nowrap text-xs text-ui-muted">Вручну: {{ moneyLabel(row.manual_discount_amount) }}</span>
            <span v-if="row.amount_status !== 'known'" class="mt-1 block text-xs font-semibold text-amber-700">{{ row.amount_status === 'unknown' ? 'Суму не визначено' : 'Суми потребують перевірки' }}</span>
            <ul v-if="row.warnings.length" class="monthly-discounts__warnings mt-1 text-xs text-ui-secondary"><li v-for="warning in row.warnings" :key="warning">{{ warningLabels[warning] }}</li></ul>
          </td>
          <td class="monthly-discounts__money">{{ moneyLabel(row.total_amount) }}</td>
        </tr>
      </BaseTable>

      <nav v-if="data && !pending && (data.total || offset)" class="monthly-discounts__pagination" aria-label="Сторінки звіту про знижки">
        <BaseButton type="button" variant="neutral" size="sm" :disabled="offset === 0" @click="offset = Math.max(0, offset - limit)">Назад</BaseButton>
        <span class="text-center text-xs text-ui-muted">Сторінка {{ Math.floor(offset / limit) + 1 }} з {{ Math.max(1, Math.ceil(data.total / limit)) }} · Візитів: {{ data.total }}</span>
        <BaseButton type="button" variant="neutral" size="sm" :disabled="offset + limit >= data.total" @click="offset += limit">Далі</BaseButton>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.monthly-discounts { min-width: 0; padding: 1rem; border: 1px solid var(--bo-border); border-radius: 1.5rem; background: var(--bo-surface); }
.monthly-discounts__header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
.monthly-discounts__filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; max-width: 28rem; margin-top: 1rem; }
.monthly-discounts__history { margin-block: 0.75rem; }
.monthly-discounts__totals { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; margin-block: 1rem 0.5rem; }
.monthly-discounts__totals dt { color: var(--bo-text-muted); font-size: 0.75rem; }
.monthly-discounts__totals dd { margin-top: 0.25rem; color: var(--bo-text-primary); font-weight: 600; font-variant-numeric: tabular-nums; }
.monthly-discounts__money { white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
.monthly-discounts__name { display: block; max-width: 12rem; overflow-wrap: anywhere; }
.monthly-discounts__warnings { min-width: 12rem; max-width: 15rem; }
.monthly-discounts__error { padding: 0.75rem; border-radius: 0.75rem; color: var(--bo-danger); background: var(--bo-danger-surface); }
.monthly-discounts__pagination { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-top: 0.75rem; }
@media (min-width: 1024px) { .monthly-discounts__totals { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
@media (max-width: 639px) { .monthly-discounts { padding: 0.625rem; border-radius: 0.875rem; } }
</style>

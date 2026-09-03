<script setup lang="ts">
import {
  ArrowPathIcon,
  BanknotesIcon,
  CakeIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  IdentificationIcon,
  PencilSquareIcon,
  PhoneIcon,
  ReceiptPercentIcon,
  ScissorsIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline'
import type { Booking } from '~/composables/useBackofficeApi'

const route = useRoute()
const api = useBackofficeApi()
const {
  bookingComment,
  bookingEnd,
  bookingStart,
  bookingServices,
  bookingServicesLabel,
  formatBookingStatus,
  formatDate,
  formatDateTime,
  formatPrice,
  formatMoney,
  formatTime,
  masterName,
  normalizeItems,
} = useBookingFormatting()

const customerId = computed(() => route.params.id as string)
const bookingPage = ref(1)
const bookingPageSize = 100

watch(customerId, () => {
  bookingPage.value = 1
})

const [{ data: customer, refresh: refreshCustomer }, { data: orders }, { data: bookings }, { data: stats }, { data: masters }] = await Promise.all([
  useAsyncData(
    () => `customer-${customerId.value}`,
    () => api.getCustomer(customerId.value),
    { watch: [customerId] },
  ),
  useAsyncData(
    () => `customer-orders-${customerId.value}`,
    () => api.getCustomerOrders(customerId.value, 1, 50),
    { watch: [customerId] },
  ),
  useAsyncData(
    () => `customer-bookings-${customerId.value}-${bookingPage.value}`,
    () => api.getCustomerBookings(customerId.value, bookingPage.value, bookingPageSize),
    { watch: [customerId, bookingPage] },
  ),
  useAsyncData(
    () => `customer-stats-${customerId.value}`,
    () => api.getCustomerStats(customerId.value),
    { watch: [customerId] },
  ),
  useAsyncData('customer-history-masters', () => api.adminGetMasters(1, 100)),
])

const fullName = computed(() => {
  if (!customer.value) return ''
  return [customer.value.name, customer.value.surname].filter(Boolean).join(' ') || 'Клієнт без імені'
})

const topServices = computed(() => stats.value?.most_used_services || [])
const customerBookings = computed<Booking[]>(() => bookings.value?.items || [])
const masterById = computed(() => new Map(normalizeItems(masters.value).map(master => [master.id, master])))
const { isAdmin } = useBackofficeAccess()
const editModalOpen = ref(false)

const handleCustomerSaved = async () => {
  await refreshCustomer()
}

const bookingSubtotal = (booking: Booking) =>
  booking.subtotal_amount ?? bookingServices(booking).reduce(
    (sum, service) => sum + Number(booking.service_prices?.[String(service.id)] ?? service.price ?? 0),
    0,
  )

const bookingDiscount = (booking: Booking) => Number(booking.discount_amount || 0)

const bookingTotal = (booking: Booking) =>
  booking.total_amount ?? Math.max(Number(bookingSubtotal(booking) || 0) - bookingDiscount(booking), 0)

const bookingHasPromotion = (booking: Booking) =>
  Boolean(
    booking.promotion_code
    || booking.promotion_id
    || booking.promotion_name_uk
    || booking.promotion_name_en
    || booking.promotion_discount_percent,
  )

const bookingPromotionLabel = (booking: Booking) => {
  const name = booking.promotion_name_uk || booking.promotion_name_en || 'Акція'
  const code = booking.promotion_code ? ` (${booking.promotion_code})` : ''
  const percent = booking.promotion_discount_percent ? ` · ${booking.promotion_discount_percent}%` : ''
  return `${name}${code}${percent}`
}

const bookingMasterLabel = (booking: Booking) => {
  const master = booking.master
    || booking.barber
    || (booking.master_id ? masterById.value.get(booking.master_id) : null)

  return master
    ? masterName(master)
    : booking.master_id
      ? `Майстер #${booking.master_id}`
      : 'Не призначено'
}

const bookingStatusTone = (status: Booking['status']): 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'danger'
  if (status === 'confirmed') return 'info'
  if (status === 'pending') return 'warning'
  return 'neutral'
}

const nextBookingPage = () => {
  if (!bookings.value || bookingPage.value * bookingPageSize >= bookings.value.total) return
  bookingPage.value += 1
}

const previousBookingPage = () => {
  bookingPage.value = Math.max(1, bookingPage.value - 1)
}

const bookingServiceLines = (booking: Booking) => {
  const services = bookingServices(booking)
  if (!services.length) return [{ name: bookingServicesLabel(booking), price: '' }]
  return services.map(service => ({
    name: service.title_uk || service.name || service.title_en || `Послуга #${service.id}`,
    price: formatPrice(booking.service_prices?.[String(service.id)] ?? service.price),
  }))
}
</script>

<template>
  <div v-if="customer" class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">CRM</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">{{ fullName }}</h1>
        <p class="mt-2 text-sm text-slate-500">Customer #{{ customer.id }}</p>
      </div>
      <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <NuxtLink to="/customers" class="rounded-full border border-slate-300 px-5 py-3 text-center text-sm">
          Назад до списку
        </NuxtLink>
        <BaseButton v-if="isAdmin" variant="primary" size="lg" @click="editModalOpen = true">
          <PencilSquareIcon class="h-4 w-4" aria-hidden="true" />
          Редагувати
        </BaseButton>
      </div>
    </div>

    <div class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Інформація про клієнта</h2>
        <dl class="customer-info-grid mt-5 grid gap-3 md:grid-cols-2">
          <div class="customer-info-item">
            <PhoneIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Телефон</dt>
              <dd class="customer-info-value">{{ customer.phone }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <EnvelopeIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Email</dt>
              <dd class="customer-info-value">{{ customer.email || '—' }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <IdentificationIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Імʼя</dt>
              <dd class="customer-info-value">{{ customer.name || '—' }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <UserCircleIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Прізвище</dt>
              <dd class="customer-info-value">{{ customer.surname || '—' }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <CakeIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Дата народження</dt>
              <dd class="customer-info-value">{{ formatDate(customer.birthday) }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <DocumentTextIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Нотатки</dt>
              <dd class="customer-info-value whitespace-pre-line">{{ customer.notes || '—' }}</dd>
            </div>
          </div>
          <div class="customer-import-grid grid gap-3 md:col-span-2 md:grid-cols-2">
            <div class="customer-import-stat">
              <BanknotesIcon class="customer-import-stat-icon" aria-hidden="true" />
              <div class="min-w-0">
                <dt class="text-xs text-slate-500">Витрати</dt>
                <dd class="mt-1 truncate font-semibold text-slate-900">{{ formatMoney(customer.imported_total_spent) }}</dd>
              </div>
            </div>
            <div class="customer-import-stat">
              <CalendarDaysIcon class="customer-import-stat-icon" aria-hidden="true" />
              <div class="min-w-0">
                <dt class="text-xs text-slate-500">Візит</dt>
                <dd class="mt-1 truncate font-semibold text-slate-900">{{ formatDateTime(customer.imported_last_visit_at) }}</dd>
              </div>
            </div>
          </div>
          <div class="customer-info-item">
            <CheckCircleIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Статус</dt>
              <dd class="mt-1">
                <span class="customer-info-badge rounded-full px-3 py-1 text-xs font-medium" :class="customer.is_active ? 'customer-info-badge-active' : 'customer-info-badge-muted'">
                  {{ customer.is_active ? 'активний' : 'неактивний' }}
                </span>
              </dd>
            </div>
          </div>
          <div class="customer-info-item">
            <ClockIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Останній вхід</dt>
              <dd class="customer-info-value">{{ formatDateTime(customer.last_login_at) }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <CalendarDaysIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Створено</dt>
              <dd class="customer-info-value">{{ formatDateTime(customer.created_at) }}</dd>
            </div>
          </div>
          <div class="customer-info-item">
            <ArrowPathIcon class="customer-info-icon" aria-hidden="true" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">Оновлено</dt>
              <dd class="customer-info-value">{{ formatDateTime(customer.updated_at) }}</dd>
            </div>
          </div>
        </dl>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Статистика бронювань</h2>

        <div class="mt-5 grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Бронювань</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ stats?.total_bookings || 0 }}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Останній візит</p>
            <p class="mt-2 text-base font-semibold text-slate-900">{{ formatDateTime(stats?.last_visit_date) }}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Топ майстер</p>
            <p class="mt-2 text-base font-semibold text-slate-900">
              {{ stats?.most_visited_barber?.name || '—' }}
            </p>
            <p v-if="stats?.most_visited_barber" class="mt-1 text-xs text-slate-500">
              {{ stats.most_visited_barber.count }} бронювань
            </p>
          </div>
        </div>

        <div class="mt-5">
          <p class="text-sm font-medium text-slate-900">Найчастіші послуги</p>
          <div v-if="topServices.length" class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="service in topServices"
              :key="`${service.id}-${service.name}`"
              class="customer-service-chip rounded-full px-3 py-1 text-xs font-medium"
            >
              {{ service.name }} · {{ service.count }}
            </span>
          </div>
          <p v-else class="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Немає даних про послуги.
          </p>
        </div>
      </section>
    </div>

    <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold text-slate-900">Історія послуг</h2>
          <p class="mt-1 text-sm text-slate-500">Коли, які послуги, за якою ціною та у якого майстра отримував клієнт.</p>
        </div>
        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {{ bookings?.total || 0 }} візитів
        </span>
      </div>

      <BaseTable
        caption="Історія послуг клієнта"
        min-width="68rem"
        wrapper-class="mt-5"
        :empty="!customerBookings.length"
        empty-title="Історії послуг ще немає"
      >
        <template #head>
          <tr>
            <th>Візит</th>
            <th>Послуги</th>
            <th>Ціна послуг</th>
            <th>Майстер</th>
            <th>Розрахунок</th>
            <th>Статус</th>
          </tr>
        </template>
        <tr v-for="booking in customerBookings" :key="`history-${booking.id}`">
          <td data-label="Візит" class="min-w-44">
            <p class="font-semibold text-ui-primary">{{ formatDate(bookingStart(booking)) }}</p>
            <p class="mt-1 text-xs text-ui-muted">
              {{ formatTime(bookingStart(booking)) }}–{{ formatTime(bookingEnd(booking)) }} · #{{ booking.id }}
            </p>
            <p v-if="booking.completed_at" class="mt-1 text-xs text-ui-muted">
              Завершено: {{ formatDateTime(booking.completed_at) }}
            </p>
          </td>
          <td data-label="Послуги" class="min-w-64">
            <div class="space-y-2">
              <p
                v-for="(service, index) in bookingServiceLines(booking)"
                :key="`${booking.id}-service-${index}`"
                class="font-medium text-ui-primary"
              >
                {{ service.name }}
              </p>
            </div>
          </td>
          <td data-label="Ціна послуг" class="min-w-36">
            <div class="space-y-2">
              <p
                v-for="(service, index) in bookingServiceLines(booking)"
                :key="`${booking.id}-price-${index}`"
                class="font-semibold text-ui-primary"
              >
                {{ service.price || '—' }}
              </p>
            </div>
          </td>
          <td data-label="Майстер" class="min-w-48">
            <p class="font-semibold text-ui-primary">{{ bookingMasterLabel(booking) }}</p>
            <p v-if="booking.master_id" class="mt-1 text-xs text-ui-muted">Майстер #{{ booking.master_id }}</p>
          </td>
          <td data-label="Розрахунок" class="min-w-52">
            <dl class="space-y-1 text-xs">
              <div class="flex items-center justify-between gap-4">
                <dt class="text-ui-muted">Послуги</dt>
                <dd class="font-medium text-ui-primary">{{ formatMoney(bookingSubtotal(booking)) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-4">
                <dt class="text-ui-muted">Знижка</dt>
                <dd class="font-medium" :class="bookingDiscount(booking) > 0 ? 'text-emerald-700' : 'text-ui-primary'">
                  -{{ formatMoney(bookingDiscount(booking)) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-4 border-t border-ui pt-1">
                <dt class="font-medium text-ui-secondary">До сплати</dt>
                <dd class="font-semibold text-ui-primary">{{ formatMoney(bookingTotal(booking)) }}</dd>
              </div>
            </dl>
            <p v-if="bookingHasPromotion(booking)" class="mt-2 text-xs font-medium text-emerald-700">
              {{ bookingPromotionLabel(booking) }}
            </p>
          </td>
          <td data-label="Статус" class="min-w-40">
            <BaseBadge :tone="bookingStatusTone(booking.status)" dot>
              {{ formatBookingStatus(booking.status) }}
            </BaseBadge>
            <p v-if="booking.cancelled_at" class="mt-2 text-xs text-ui-muted">
              {{ formatDateTime(booking.cancelled_at) }}
            </p>
          </td>
        </tr>
      </BaseTable>

      <div v-if="(bookings?.total || 0) > bookingPageSize" class="mt-4 flex flex-wrap items-center gap-3">
        <BaseButton variant="neutral" :disabled="bookingPage === 1" @click="previousBookingPage">
          Попередня
        </BaseButton>
        <span class="text-sm text-ui-muted">Сторінка {{ bookingPage }}</span>
        <BaseButton
          variant="neutral"
          :disabled="!bookings || bookingPage * bookingPageSize >= bookings.total"
          @click="nextBookingPage"
        >
          Наступна
        </BaseButton>
      </div>
    </section>

    <MessagingClientCommunicationPanel v-if="isAdmin" :customer-id="customer.id" />

    <CustomerEditModal
      v-if="isAdmin"
      v-model="editModalOpen"
      :customer="customer"
      @saved="handleCustomerSaved"
    />

    <div class="grid gap-6 xl:grid-cols-2">
      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h2 class="text-xl font-semibold text-slate-900">Замовлення</h2>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {{ orders?.total || 0 }} усього
          </span>
        </div>

        <div v-if="orders?.items.length" class="mt-5 space-y-3">
          <article v-for="order in orders?.items || []" :key="order.id" class="rounded-2xl bg-slate-50 p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="font-medium text-slate-900">Замовлення #{{ order.id }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ order.customer_email || order.customer_phone || 'Без контактів' }}</p>
              </div>
              <div class="sm:text-right">
                <p class="font-semibold text-slate-900">{{ order.total_amount }}</p>
                <p class="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-700">{{ order.status }}</p>
              </div>
            </div>
            <p class="mt-3 text-xs text-slate-500">
              Створено: {{ formatDateTime(order.created_at) }}
            </p>
          </article>
        </div>
        <p v-else class="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          У цього клієнта ще немає замовлень.
        </p>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h2 class="text-xl font-semibold text-slate-900">Бронювання</h2>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {{ bookings?.total || 0 }} усього
          </span>
        </div>

        <div v-if="bookings?.items.length" class="mt-5 space-y-3">
          <article v-for="booking in bookings?.items || []" :key="booking.id" class="rounded-2xl bg-slate-50 p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p class="font-medium text-slate-900">Бронювання #{{ booking.id }}</p>
                <p class="mt-1 text-sm text-slate-500">
                  {{ formatDate(bookingStart(booking)) }} · {{ formatTime(bookingStart(booking)) }}-{{ formatTime(bookingEnd(booking)) }}
                </p>
              </div>
              <div class="sm:text-right">
                <p class="text-xs uppercase tracking-[0.2em] text-cyan-700">{{ formatBookingStatus(booking.status) }}</p>
                <p class="mt-1 text-sm text-slate-500">Майстер #{{ booking.master_id }} · {{ bookingServicesLabel(booking) }}</p>
              </div>
            </div>
            <div class="booking-money-card mt-3 rounded-2xl px-3 py-3">
              <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <ScissorsIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Послуги та оплата
              </p>
              <div class="mt-3 space-y-2">
                <div v-for="service in bookingServiceLines(booking)" :key="`booking-${booking.id}-${service.name}`" class="flex items-start justify-between gap-3 text-sm">
                  <span class="min-w-0 break-words text-slate-900">{{ service.name }}</span>
                  <span class="shrink-0 font-medium text-slate-700">{{ service.price || '—' }}</span>
                </div>
              </div>
              <div class="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <span class="text-slate-500">Послуги: <strong class="text-slate-900">{{ formatMoney(bookingSubtotal(booking)) }}</strong></span>
                <span class="text-slate-500">Знижка: <strong :class="bookingDiscount(booking) > 0 ? 'text-emerald-700' : 'text-slate-900'">-{{ formatMoney(bookingDiscount(booking)) }}</strong></span>
                <span class="text-slate-500">До сплати: <strong class="text-slate-900">{{ formatMoney(bookingTotal(booking)) }}</strong></span>
              </div>
              <p v-if="bookingHasPromotion(booking)" class="booking-promotion-chip mt-3 inline-flex max-w-full items-start gap-2 rounded-full px-3 py-1.5 text-xs font-semibold">
                <ReceiptPercentIcon class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span class="min-w-0 break-words">Стрижка за акцією: {{ bookingPromotionLabel(booking) }}</span>
              </p>
            </div>
            <div class="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>{{ booking.customer_email || booking.customer_phone || 'Без контактів' }}</p>
              <p v-if="booking.cancelled_at">Скасовано: {{ formatDateTime(booking.cancelled_at) }}</p>
              <p v-if="booking.completed_at">Завершено: {{ formatDateTime(booking.completed_at) }}</p>
            </div>
            <p v-if="bookingComment(booking)" class="mt-3 whitespace-pre-line text-sm text-slate-600">
              {{ bookingComment(booking) }}
            </p>
          </article>
        </div>
        <p v-else class="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          У цього клієнта ще немає бронювань.
        </p>
      </section>
    </div>
  </div>
</template>

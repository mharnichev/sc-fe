<script setup lang="ts">
import { EyeIcon } from '@heroicons/vue/24/outline'

const api = useBackofficeApi()
const { formatDateTime, formatMoney } = useBookingFormatting()
const page = ref(1)
const pageSize = 20
const filters = reactive({
  search: '',
  is_active: '',
  is_verified: '',
  telegram_connected: '',
  sort_by: 'created_at',
  sort_order: 'desc',
})
const activeFilterCount = computed(() => [
  filters.search.trim(),
  filters.is_active,
  filters.is_verified,
  filters.telegram_connected,
  filters.sort_by !== 'created_at' ? filters.sort_by : '',
].filter(Boolean).length)

const activeStatusOptions = [
  { value: '', label: 'Будь-який статус' },
  { value: 'true', label: 'Активні' },
  { value: 'false', label: 'Неактивні' },
]

const verificationOptions = [
  { value: '', label: 'Будь-яка верифікація' },
  { value: 'true', label: 'Верифіковані' },
  { value: 'false', label: 'Не верифіковані' },
]

const telegramOptions = [
  { value: '', label: 'Будь-який TG' },
  { value: 'true', label: 'TG підключено' },
  { value: 'false', label: 'TG не підключено' },
]

const sortOptions = [
  { value: 'created_at', label: 'Створено' },
  { value: 'last_login_at', label: 'Останній вхід' },
  { value: 'name', label: 'Ім’я' },
  { value: 'surname', label: 'Прізвище' },
  { value: 'phone', label: 'Телефон' },
  { value: 'id', label: 'ID' },
]

const { data, pending, refresh } = await useAsyncData(
  'backoffice-customers',
  () =>
    api.getCustomers(page.value, pageSize, {
      search: filters.search || undefined,
      is_active: filters.is_active || null,
      is_verified: filters.is_verified || null,
      telegram_connected: filters.telegram_connected || null,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order,
    }),
  { watch: [page] },
)

const applyFilters = async () => {
  const shouldRefreshImmediately = page.value === 1
  page.value = 1
  if (shouldRefreshImmediately) await refresh()
}

const clearFilters = async () => {
  const shouldRefreshImmediately = page.value === 1
  filters.search = ''
  filters.is_active = ''
  filters.is_verified = ''
  filters.telegram_connected = ''
  filters.sort_by = 'created_at'
  filters.sort_order = 'desc'
  page.value = 1
  if (shouldRefreshImmediately) {
    await refresh()
  }
}

const next = async () => {
  if (!data.value || page.value * pageSize >= data.value.total) return
  page.value += 1
}

const prev = async () => {
  page.value = Math.max(1, page.value - 1)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="ui-eyebrow text-sm uppercase tracking-[0.3em]">CRM</p>
      <h1 class="mt-2 text-3xl font-semibold text-ui-primary">Клієнти</h1>
    </div>

    <BaseFilterPanel
      :loading="pending"
      :active-count="activeFilterCount"
      mobile-title="Фільтри клієнтів"
      fields-class="md:grid-cols-2 xl:grid-cols-3"
      @apply="applyFilters"
      @clear="clearFilters"
    >
      <BaseInput v-model="filters.search" placeholder="Пошук за телефоном, email або ім’ям" aria-label="Пошук клієнтів" />
      <BaseSelect v-model="filters.is_active" :options="activeStatusOptions" aria-label="Статус клієнта" menu-class="z-[220]" />
      <BaseSelect v-model="filters.is_verified" :options="verificationOptions" aria-label="Верифікація клієнта" menu-class="z-[220]" />
      <BaseSelect v-model="filters.telegram_connected" :options="telegramOptions" aria-label="Telegram клієнта" menu-class="z-[220]" />
      <BaseSelect v-model="filters.sort_by" :options="sortOptions" aria-label="Сортування клієнтів" menu-class="z-[220]" />
    </BaseFilterPanel>

    <BaseCard variant="subtle" padding="sm" class="text-sm text-ui-secondary">
      Усього клієнтів: {{ data?.total || 0 }}
    </BaseCard>

    <BaseTable
      sticky-actions
      caption="Список клієнтів"
      min-width="72rem"
      :empty="!data?.items.length"
      empty-title="Клієнтів за цими фільтрами не знайдено"
    >
      <template #head>
        <tr>
          <th>ID</th>
          <th>Клієнт</th>
          <th>Контакти</th>
          <th>Прізвище</th>
          <th>Імпорт</th>
          <th>Нотатки</th>
          <th>Telegram</th>
          <th>Верифікація</th>
          <th class="customers-actions-column">Дії</th>
        </tr>
      </template>
          <tr v-for="item in data?.items || []" :key="item.id">
            <td data-label="ID" class="text-ui-secondary">{{ item.id }}</td>
            <td data-label="Клієнт" class="px-4 py-3">
              <p class="font-medium text-ui-primary">{{ item.name || 'Клієнт без імені' }}</p>
              <p class="mt-1 text-xs text-ui-muted">Customer #{{ item.id }}</p>
            </td>
            <td data-label="Контакти" class="px-4 py-3">
              <p class="font-medium text-ui-primary">{{ item.phone }}</p>
              <p class="mt-1 text-xs text-ui-muted">{{ item.email || 'Без email' }}</p>
            </td>
            <td data-label="Прізвище" class="text-ui-secondary">{{ item.surname || '—' }}</td>
            <td data-label="Імпорт" class="text-ui-secondary">
              <p class="font-medium text-ui-primary">{{ formatMoney(item.imported_total_spent) }}</p>
              <p class="mt-1 text-xs text-ui-muted">{{ formatDateTime(item.imported_last_visit_at) }}</p>
              <BaseBadge v-if="item.imported_is_new_client" tone="info" class="mt-2">новий</BaseBadge>
            </td>
            <td data-label="Нотатки" class="max-w-xs text-ui-secondary">
              <p class="line-clamp-2">{{ item.notes || '—' }}</p>
            </td>
            <td data-label="Telegram" class="px-4 py-3">
              <BaseBadge :tone="item.telegram_connected ? 'info' : 'neutral'">
                {{ item.telegram_connected ? 'TG підключено' : 'немає TG' }}
              </BaseBadge>
            </td>
            <td data-label="Верифікація" class="px-4 py-3">
              <BaseBadge :tone="item.is_verified ? 'success' : 'neutral'">
                {{ item.is_verified ? 'верифіковано' : 'не верифіковано' }}
              </BaseBadge>
            </td>
            <td data-label="Дії" class="customers-actions-column px-4 py-3">
              <NuxtLink
                :to="`/customers/${item.id}`"
                class="customers-view-button base-button base-button--icon h-8 w-8 p-0"
                aria-label="Переглянути клієнта"
                title="Переглянути"
              >
                <EyeIcon class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only">Переглянути</span>
              </NuxtLink>
            </td>
          </tr>
    </BaseTable>

    <div class="flex flex-wrap items-center gap-3">
      <BaseButton variant="neutral" :disabled="page === 1" @click="prev">Попередня</BaseButton>
      <span class="text-sm text-ui-muted">Сторінка {{ page }}</span>
      <BaseButton variant="neutral" :disabled="!data || page * pageSize >= data.total" @click="next">Наступна</BaseButton>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 767px) {
  .customers-actions-column {
    width: 4.75rem;
    min-width: 4.75rem;
  }

  .customers-view-button {
    width: 2.75rem;
    height: 2.75rem;
  }
}
</style>

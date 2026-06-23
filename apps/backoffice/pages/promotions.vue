<script setup lang="ts">
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  FunnelIcon,
  LanguageIcon,
  NoSymbolIcon,
  PencilIcon,
  PlusIcon,
  ReceiptPercentIcon,
  TicketIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/vue/24/outline'
import type { Promotion } from '~/composables/useBackofficeApi'

definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') {
      return navigateTo('/')
    }
  },
})

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { apiErrorMessage, formatDateTime, normalizeItems, normalizeTotal } = useBookingFormatting()

const page = ref(1)
const pageSize = 100
const filters = reactive({ search: '', is_active: '' })
const editing = ref<Promotion | null>(null)
const promotionModalOpen = ref(false)
const togglingPromotion = ref<Promotion | null>(null)
const togglePending = ref(false)
const deletingPromotion = ref<Promotion | null>(null)
const deletePending = ref(false)

const { data, pending, error, refresh } = await useAsyncData(
  'admin-promotions',
  () => api.adminGetPromotions(page.value, pageSize, {
    search: filters.search || undefined,
    is_active: filters.is_active === '' ? null : filters.is_active === 'true',
  }),
  { watch: [page] },
)

const promotions = computed(() => normalizeItems(data.value))
const total = computed(() => normalizeTotal(data.value))
const activeCount = computed(() => promotions.value.filter(promotion => promotion.is_active).length)
const inactiveCount = computed(() => promotions.value.length - activeCount.value)

const promotionName = (promotion: Promotion) =>
  promotion.name_uk || promotion.name_en || promotion.code

const eligibilityLabel = (promotion: Promotion) => {
  if (promotion.eligibility_type === 'inactive_customers') {
    return `Неактивні ${promotion.inactive_days || 90}+ днів`
  }
  return 'Усі клієнти'
}

const promotionPeriod = (promotion: Promotion) => {
  if (!promotion.starts_at && !promotion.ends_at) return 'Без обмеження'
  if (promotion.starts_at && promotion.ends_at) return `${formatDateTime(promotion.starts_at)} - ${formatDateTime(promotion.ends_at)}`
  if (promotion.starts_at) return `З ${formatDateTime(promotion.starts_at)}`
  return `До ${formatDateTime(promotion.ends_at)}`
}

const openCreatePromotion = () => {
  editing.value = null
  promotionModalOpen.value = true
}

const editPromotion = (promotion: Promotion) => {
  editing.value = promotion
  promotionModalOpen.value = true
}

const handlePromotionSaved = async (message: string) => {
  toast.success(message)
  editing.value = null
  await refresh()
}

const handlePromotionModalUpdate = (value: boolean) => {
  promotionModalOpen.value = value
  if (!value) editing.value = null
}

const applyFilters = async () => {
  page.value = 1
  if (page.value === 1) await refresh()
}

const toggleContextItems = computed(() => {
  if (!togglingPromotion.value) return []
  return [
    { label: 'Акція', value: promotionName(togglingPromotion.value) },
    { label: 'Код', value: togglingPromotion.value.code },
    { label: 'Новий статус', value: togglingPromotion.value.is_active ? 'неактивна' : 'активна' },
  ]
})

const openTogglePromotionConfirm = (promotion: Promotion) => {
  togglingPromotion.value = promotion
}

const handleToggleConfirmUpdate = (value: boolean) => {
  if (!value && !togglePending.value) togglingPromotion.value = null
}

const confirmTogglePromotion = async () => {
  const promotion = togglingPromotion.value
  if (!promotion) return

  togglePending.value = true
  try {
    await api.adminUpdatePromotion(promotion.id, { is_active: !promotion.is_active })
    toast.success('Статус акції оновлено.')
    togglingPromotion.value = null
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося оновити статус акції.'))
  }
  finally {
    togglePending.value = false
  }
}

const deleteContextItems = computed(() => {
  if (!deletingPromotion.value) return []
  return [
    { label: 'Акція', value: promotionName(deletingPromotion.value) },
    { label: 'Код', value: deletingPromotion.value.code },
    { label: 'Знижка', value: `${deletingPromotion.value.discount_percent}%` },
  ]
})

const openDeletePromotionConfirm = (promotion: Promotion) => {
  deletingPromotion.value = promotion
}

const handleDeleteConfirmUpdate = (value: boolean) => {
  if (!value && !deletePending.value) deletingPromotion.value = null
}

const confirmDeletePromotion = async () => {
  const promotion = deletingPromotion.value
  if (!promotion) return

  deletePending.value = true
  try {
    await api.adminDeletePromotion(promotion.id)
    toast.success('Акцію деактивовано.')
    if (editing.value?.id === promotion.id) editing.value = null
    deletingPromotion.value = null
    await refresh()
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося деактивувати акцію.'))
  }
  finally {
    deletePending.value = false
  }
}
</script>

<template>
  <div class="space-y-4 xl:space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.22em] text-cyan-700 xl:text-sm xl:tracking-[0.3em]">Барбершоп</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900 xl:mt-2 xl:text-3xl">Акції</h1>
      </div>
      <button type="button" class="backoffice-page-create-button inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition sm:w-auto xl:min-h-10 xl:gap-2 xl:px-4 xl:py-2.5 xl:text-sm" @click="openCreatePromotion">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Створити акцію
      </button>
    </div>

    <section class="grid gap-3 sm:grid-cols-3">
      <article class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm xl:rounded-[1.5rem]">
        <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Усього</p>
        <p class="mt-2 text-2xl font-semibold text-slate-900">{{ total }}</p>
      </article>
      <article class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm xl:rounded-[1.5rem]">
        <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Активні</p>
        <p class="mt-2 text-2xl font-semibold text-emerald-700">{{ activeCount }}</p>
      </article>
      <article class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm xl:rounded-[1.5rem]">
        <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Неактивні</p>
        <p class="mt-2 text-2xl font-semibold text-slate-700">{{ inactiveCount }}</p>
      </article>
    </section>

    <section class="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-sm xl:space-y-4 xl:rounded-[1.5rem] xl:p-4">
      <div class="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <input v-model="filters.search" placeholder="Пошук за кодом або назвою" class="rounded-xl border border-slate-300 px-3 py-2.5 text-sm xl:rounded-2xl xl:px-4">
        <select v-model="filters.is_active" class="rounded-xl border border-slate-300 px-3 py-2.5 text-sm xl:rounded-2xl xl:px-4">
          <option value="">Будь-який статус</option>
          <option value="true">Активні</option>
          <option value="false">Неактивні</option>
        </select>
        <button class="backoffice-modal-action-button backoffice-modal-action-primary" @click="applyFilters">
          <FunnelIcon class="h-4 w-4" aria-hidden="true" />
          <span>Застосувати</span>
        </button>
      </div>

      <p v-if="error" class="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 xl:rounded-2xl xl:px-4 xl:py-3 xl:text-sm">
        {{ apiErrorMessage(error, 'Не вдалося завантажити акції з /backoffice/promotions.') }}
      </p>

      <div v-if="pending" class="text-xs text-slate-500 xl:text-sm">Завантаження акцій...</div>
      <div v-else-if="!promotions.length" class="text-xs text-slate-500 xl:text-sm">Акцій не знайдено.</div>
      <div v-else class="overflow-x-auto">
        <table class="service-table min-w-full divide-y divide-slate-100 text-left text-sm">
          <thead class="text-xs uppercase text-slate-500">
            <tr>
              <th class="px-3 py-2.5 font-medium">Акція</th>
              <th class="px-3 py-2.5 font-medium">Знижка</th>
              <th class="px-3 py-2.5 font-medium">Аудиторія</th>
              <th class="px-3 py-2.5 font-medium">Період</th>
              <th class="px-3 py-2.5 font-medium">Статус</th>
              <th class="px-3 py-2.5 font-medium"><span class="sr-only">Дії</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="promotion in promotions" :key="promotion.id">
              <td data-label="Акція" class="service-name-cell px-3 py-2.5">
                <div class="min-w-0 text-left">
                  <p class="flex min-w-0 items-start gap-1.5 font-medium leading-snug text-slate-900">
                    <TicketIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-700" aria-hidden="true" />
                    <span class="min-w-0 break-words">{{ promotionName(promotion) }}</span>
                  </p>
                  <p class="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <span class="min-w-0 break-all">{{ promotion.code }}</span>
                  </p>
                  <p class="mt-1.5 break-words text-xs leading-5 text-slate-500">{{ promotion.description_uk || 'Без опису' }}</p>
                  <p class="mt-1.5 flex min-w-0 items-start gap-1.5 text-xs font-medium leading-5 text-slate-700">
                    <LanguageIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span class="min-w-0 break-words">{{ promotion.name_en }}</span>
                  </p>
                </div>
              </td>
              <td data-label="Знижка" class="px-3 py-2.5 text-slate-700">
                <span class="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
                  <ReceiptPercentIcon class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ promotion.discount_percent }}%
                </span>
              </td>
              <td data-label="Аудиторія" class="px-3 py-2.5 text-slate-700">
                <span class="inline-flex items-center gap-1.5 text-sm">
                  <UserGroupIcon class="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  {{ eligibilityLabel(promotion) }}
                </span>
              </td>
              <td data-label="Період" class="px-3 py-2.5 text-slate-700">
                <span class="inline-flex max-w-xs items-start gap-1.5 text-sm leading-5">
                  <CalendarDaysIcon class="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span class="break-words">{{ promotionPeriod(promotion) }}</span>
                </span>
              </td>
              <td data-label="Статус" class="px-3 py-2.5">
                <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="promotion.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                  {{ promotion.is_active ? 'активна' : 'неактивна' }}
                </span>
              </td>
              <td class="service-actions px-3 py-2.5">
                <div class="flex flex-wrap gap-1.5">
                  <button
                    class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                    aria-label="Редагувати акцію"
                    title="Редагувати"
                    @click="editPromotion(promotion)"
                  >
                    <PencilIcon class="h-3.5 w-3.5" aria-hidden="true" />
                    <span class="sr-only">Редагувати</span>
                  </button>
                  <button
                    class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
                    :aria-label="promotion.is_active ? 'Деактивувати акцію' : 'Активувати акцію'"
                    :title="promotion.is_active ? 'Деактивувати' : 'Активувати'"
                    @click="openTogglePromotionConfirm(promotion)"
                  >
                    <template v-if="promotion.is_active">
                      <NoSymbolIcon class="h-3.5 w-3.5" aria-hidden="true" />
                      <span class="sr-only">Деактивувати</span>
                    </template>
                    <template v-else>
                      <CheckCircleIcon class="h-3.5 w-3.5" aria-hidden="true" />
                      <span class="sr-only">Активувати</span>
                    </template>
                  </button>
                  <button
                    class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                    :disabled="!promotion.is_active"
                    aria-label="Видалити акцію"
                    title="Видалити"
                    @click="openDeletePromotionConfirm(promotion)"
                  >
                    <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
                    <span class="sr-only">Видалити</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <PromotionFormModal
      :model-value="promotionModalOpen"
      :promotion="editing"
      @saved="handlePromotionSaved"
      @update:model-value="handlePromotionModalUpdate"
    />
    <ConfirmActionModal
      :model-value="Boolean(togglingPromotion)"
      :title="togglingPromotion?.is_active ? 'Деактивувати акцію?' : 'Активувати акцію?'"
      :message="togglingPromotion?.is_active ? 'Акція перестане застосовуватися до нових бронювань. Ви точно хочете виконати цю дію?' : 'Акція знову стане доступною для нових бронювань. Ви точно хочете виконати цю дію?'"
      :confirm-label="togglingPromotion?.is_active ? 'Так, деактивувати' : 'Так, активувати'"
      :context-items="toggleContextItems"
      :pending="togglePending"
      :destructive="Boolean(togglingPromotion?.is_active)"
      @confirm="confirmTogglePromotion"
      @update:model-value="handleToggleConfirmUpdate"
    />
    <ConfirmActionModal
      :model-value="Boolean(deletingPromotion)"
      title="Видалити акцію?"
      message="Backend виконує soft delete: акція стане неактивною і не застосовуватиметься до нових бронювань."
      confirm-label="Так, видалити"
      :context-items="deleteContextItems"
      :pending="deletePending"
      destructive
      @confirm="confirmDeletePromotion"
      @update:model-value="handleDeleteConfirmUpdate"
    />
  </div>
</template>

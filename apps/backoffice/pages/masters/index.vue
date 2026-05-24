<script setup lang="ts">
import { CheckCircleIcon, NoSymbolIcon, PencilIcon, PlusIcon } from '@heroicons/vue/24/outline'
import type { Master } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const auth = useAuthStore()
const { masterName, normalizeItems, normalizeTotal, apiErrorMessage } = useBookingFormatting()

const isAdmin = computed(() => Boolean(auth.user?.is_superuser || auth.user?.role === 'admin'))
const page = ref(1)
const pageSize = 100
const filters = reactive({ search: '', is_active: '' })
const editing = ref<Master | null>(null)
const formError = ref('')
const successMessage = ref('')
const masterModalOpen = ref(false)
const togglingMaster = ref<Master | null>(null)
const togglePending = ref(false)

const { data, pending, error, refresh } = await useAsyncData(
  'admin-masters',
  () => {
    if (!isAdmin.value) return Promise.resolve([] as Master[])
    return api.adminGetMasters(page.value, pageSize, {
      search: filters.search || undefined,
      is_active: filters.is_active === '' ? null : filters.is_active === 'true',
    })
  },
  { watch: [page] },
)

const masters = computed(() => normalizeItems(data.value))
const total = computed(() => normalizeTotal(data.value))
const isMasterActive = (master: Master) => Boolean(master.is_active ?? master.status !== 'неактивний')

const openCreateMaster = () => {
  editing.value = null
  formError.value = ''
  successMessage.value = ''
  masterModalOpen.value = true
}

const editMaster = (master: Master) => {
  editing.value = master
  formError.value = ''
  successMessage.value = ''
  masterModalOpen.value = true
}

const handleMasterSaved = async (message: string) => {
  successMessage.value = message
  formError.value = ''
  editing.value = null
  await refresh()
}

const handleMasterModalUpdate = (value: boolean) => {
  masterModalOpen.value = value
  if (!value) editing.value = null
}

const toggleContextItems = computed(() => {
  if (!togglingMaster.value) return []
  return [
    { label: 'Майстер', value: masterName(togglingMaster.value) },
    { label: 'Поточний статус', value: isMasterActive(togglingMaster.value) ? 'активний' : 'неактивний' },
    { label: 'Новий статус', value: isMasterActive(togglingMaster.value) ? 'неактивний' : 'активний' },
  ]
})

const openToggleMasterConfirm = (master: Master) => {
  if (!isAdmin.value) return
  formError.value = ''
  successMessage.value = ''
  togglingMaster.value = master
}

const handleToggleConfirmUpdate = (value: boolean) => {
  if (!value && !togglePending.value) togglingMaster.value = null
}

const confirmToggleMaster = async () => {
  const master = togglingMaster.value
  if (!master) return

  formError.value = ''
  successMessage.value = ''
  togglePending.value = true
  try {
    await api.adminUpdateMaster(master.id, { is_active: !isMasterActive(master) })
    successMessage.value = 'Статус майстра оновлено.'
    togglingMaster.value = null
    await refresh()
  }
  catch (cause) {
    formError.value = apiErrorMessage(cause, 'Не вдалося оновити статус майстра.')
  }
  finally {
    togglePending.value = false
  }
}

const applyFilters = async () => {
  if (!isAdmin.value) return
  page.value = 1
  if (page.value === 1) await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Адмін</p>
        <h1 class="mt-2 text-3xl font-semibold text-slate-900">Майстри</h1>
      </div>
      <button
        type="button"
        :disabled="!isAdmin"
        class="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        @click="openCreateMaster"
      >
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Створити майстра
      </button>
    </div>

    <p v-if="!isAdmin" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
      Для керування майстрами потрібен доступ адміністратора.
    </p>

    <p v-if="formError" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ formError }}</p>
    <p v-if="successMessage" class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ successMessage }}</p>

    <section class="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div class="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <input v-model="filters.search" placeholder="Пошук майстрів" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <select v-model="filters.is_active" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
          <option value="">Будь-який статус</option>
          <option value="true">Активні</option>
          <option value="false">Неактивні</option>
        </select>
        <button class="rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white" @click="applyFilters">Застосувати</button>
      </div>
      <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
        {{ apiErrorMessage(error, 'Не вдалося завантажити майстрів.') }}
      </p>
      <p class="rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">Total: {{ total }}</p>
      <div v-if="pending" class="text-sm text-slate-500">Завантаження майстрів...</div>
      <div v-else-if="!masters.length" class="text-sm text-slate-500">Майстрів не знайдено.</div>
      <div v-else class="divide-y divide-slate-100">
        <article v-for="master in masters" :key="master.id" class="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p class="font-medium text-slate-900">{{ masterName(master) }}</p>
            <p class="text-sm text-slate-500">{{ master.phone || master.email || 'Без контактів' }}</p>
            <p class="text-xs text-slate-500">{{ master.services?.map(service => service.name).join(', ') || 'Немає призначених послуг' }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full px-3 py-1 text-xs font-medium" :class="isMasterActive(master) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
              {{ isMasterActive(master) ? 'активний' : 'неактивний' }}
            </span>
            <NuxtLink class="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700" :to="`/masters/${master.id}/services`">Послуги</NuxtLink>
            <button
              class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50"
              aria-label="Редагувати майстра"
              title="Редагувати"
              @click="editMaster(master)"
            >
              <PencilIcon class="h-4 w-4" aria-hidden="true" />
              <span class="sr-only">Редагувати</span>
            </button>
            <button
              class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              :disabled="!isAdmin"
              :aria-label="isMasterActive(master) ? 'Деактивувати майстра' : 'Активувати майстра'"
              :title="isMasterActive(master) ? 'Деактивувати' : 'Активувати'"
              @click="openToggleMasterConfirm(master)"
            >
              <template v-if="isMasterActive(master)">
                <NoSymbolIcon class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only">Деактивувати</span>
              </template>
              <template v-else>
                <CheckCircleIcon class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only">Активувати</span>
              </template>
            </button>
          </div>
        </article>
      </div>
    </section>

    <MasterFormModal
      :model-value="masterModalOpen"
      :master="editing"
      :disabled="!isAdmin"
      @saved="handleMasterSaved"
      @update:model-value="handleMasterModalUpdate"
    />
    <ConfirmActionModal
      :model-value="Boolean(togglingMaster)"
      :title="togglingMaster && isMasterActive(togglingMaster) ? 'Деактивувати майстра?' : 'Активувати майстра?'"
      :message="togglingMaster && isMasterActive(togglingMaster) ? 'Майстер стане неактивним і не має використовуватися для нових операцій. Ви точно впевнені, що хочете деактивувати цього майстра?' : 'Майстер знову стане активним і доступним для роботи. Ви точно впевнені, що хочете активувати цього майстра?'"
      :confirm-label="togglingMaster && isMasterActive(togglingMaster) ? 'Так, деактивувати' : 'Так, активувати'"
      :context-items="toggleContextItems"
      :pending="togglePending"
      :destructive="Boolean(togglingMaster && isMasterActive(togglingMaster))"
      @confirm="confirmToggleMaster"
      @update:model-value="handleToggleConfirmUpdate"
    />
  </div>
</template>

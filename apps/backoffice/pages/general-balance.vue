<script setup lang="ts">
import { ArrowDownRightIcon, ArrowUpRightIcon, ArrowsUpDownIcon, BanknotesIcon, CalendarDaysIcon, DocumentTextIcon, FunnelIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { canAccessShopBalance } from '~/utils/shopBalanceAccess'

definePageMeta({
  middleware: () => {
    if (!canAccessShopBalance(useAuthStore().user)) return navigateTo('/dashboard')
  },
})
useHead({ title: 'Загальний баланс' })
useSeoMeta({ robots: 'noindex, nofollow, noarchive' })

type Kind = 'income' | 'expense'
type Entry = {
  id: string
  kind: Kind
  description: string
  amount_minor: number
  author_email: string
  created_at: string
  entry_date?: string | null
  updated_at?: string | null
  updated_by_email?: string | null
}
type Totals = Record<Kind, bigint>

const timeZone = 'Europe/Kyiv'
const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormat = new Intl.DateTimeFormat('uk-UA', { timeZone, dateStyle: 'medium', timeStyle: 'short' })
const currencyFormat = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' })
const monthPattern = /^20\d{2}-(0[1-9]|1[0-2])$/
const api = useApi()
const lifetime = new AbortController()

const auth = useAuthStore()
const granted = ref(false)
const entryFormOpen = ref(false)
const editingId = ref<string | null>(null)
const entryFormTitle = computed(() => editingId.value ? 'Редагування запису' : 'Новий запис')
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const formError = ref('')
const notice = ref('')
const month = ref(dayFormat.format(new Date()).slice(0, 7))
const comparison = ref('')
const day = ref('')
const filterKind = ref('')
const sort = ref('newest')
const isIncome = ref(false)
const description = ref('')
const entryDate = ref('')
const amount = ref<string | number | null>('')
const entryToDelete = shallowRef<Entry | null>(null)
const deleting = ref(false)
const deleteError = ref('')
const selectedEntry = shallowRef<Entry | null>(null)
const compactDateFormat = new Intl.DateTimeFormat('uk-UA', { timeZone, day: '2-digit', month: '2-digit' })
const records = shallowRef<Record<string, Entry[]>>({})
const pendingIds = new Map<string, string>()
let loadVersion = 0

const entriesPath = '/backoffice/shop-balance/entries'
const entries = computed(() => (records.value[month.value] ?? []).map(entry => ({
  ...entry,
  day: effectiveDate(entry),
})))
const visibleEntries = computed(() => {
  const selected = entries.value.filter(entry =>
    (!day.value || entry.day === day.value)
    && (!filterKind.value || entry.kind === filterKind.value),
  )
  return sort.value === 'oldest' ? selected.reverse() : selected
})
const days = computed(() => [...new Set(entries.value.map(entry => entry.day))])
const monthlyTotals = computed(() => Object.entries(records.value).map(([period, rows]) => {
  const totals: Totals = { income: BigInt(0), expense: BigInt(0) }
  for (const row of rows) totals[row.kind] += BigInt(row.amount_minor)
  return [period, totals] as const
}))

function netTone({ income, expense }: Totals) {
  if (income > expense) return 'balance-income'
  if (income < expense) return 'balance-expense'
}

function money(minor: number | bigint) {
  const value = BigInt(minor)
  const absolute = value < BigInt(0) ? -value : value
  const cents = String(absolute % BigInt(100)).padStart(2, '0')
  return (value < BigInt(0) ? '−' : '') + currencyFormat.formatToParts(absolute / BigInt(100))
    .map(part => part.type === 'fraction' ? cents : part.value).join('')
}

function request<T>(options: Parameters<typeof api>[1], path = entriesPath) {
  return api<T>(path, {
    credentials: 'omit',
    signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(15000)]),
    retry: 0,
    ...options,
  })
}

function statusCode(error: unknown) {
  return (error as { response?: Response } | null)?.response?.status
}

function effectiveDate(entry: Entry) {
  return entry.entry_date ?? dayFormat.format(new Date(entry.created_at))
}

function clearDraft() {
  editingId.value = null
  entryDate.value = dayFormat.format(new Date())
  isIncome.value = false
  description.value = ''
  amount.value = ''
  formError.value = ''
}

function openEntryForm(entry?: Entry) {
  clearDraft()
  if (entry) {
    editingId.value = entry.id
    entryDate.value = effectiveDate(entry)
    isIncome.value = entry.kind === 'income'
    description.value = entry.description
    amount.value = (entry.amount_minor / 100).toFixed(2)
    selectedEntry.value = null
  }
  entryFormOpen.value = true
}

function clearJournal() {
  entryToDelete.value = null
  deleting.value = false
  deleteError.value = ''
  entryFormOpen.value = false
  selectedEntry.value = null
  ++loadVersion
  records.value = {}
  granted.value = false
  loading.value = false
  saving.value = false
  loadError.value = ''
  notice.value = ''
  day.value = ''
  pendingIds.clear()
  clearDraft()
}

function handleAccessError(error: unknown) {
  const status = statusCode(error)
  if (status !== 401 && status !== 403) return false
  clearJournal()
  loadError.value = status === 403 ? 'Доступ до загального балансу закрито.' : 'Сеанс завершився. Увійдіть знову.'
  return true
}

async function loadEntries() {
  if (!canAccessShopBalance(auth.user) || !auth.accessToken) return
  const version = ++loadVersion
  records.value = {}
  loadError.value = ''
  loading.value = false
  const periods = [...new Set([month.value, comparison.value].filter(Boolean))]
  if (!month.value || periods.some(period => !monthPattern.test(period))) {
    loadError.value = 'Виберіть місяць у межах 2000–2099 років.'
    return
  }

  loading.value = true
  try {
    const results = await Promise.all(periods.map(async period => [
      period,
      await request<Entry[]>({
        query: { month: period },
      }).catch((error: unknown) => {
        if (version === loadVersion && !lifetime.signal.aborted) handleAccessError(error)
        throw error
      }),
    ] as const))
    if (version !== loadVersion || lifetime.signal.aborted) return
    records.value = Object.fromEntries(results)
    granted.value = true
  } catch {
    if (lifetime.signal.aborted) return
    if (version === loadVersion) loadError.value = 'Не вдалося завантажити журнал.'
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

async function saveEntry() {
  if (!canAccessShopBalance(auth.user) || !auth.accessToken || saving.value || loading.value || !granted.value) return
  const adminId = auth.user?.id
  formError.value = ''
  notice.value = ''
  const text = description.value.trim()
  const decimal = /^(\d{1,10})(?:[,.](\d{1,2}))?$/.exec(String(amount.value ?? '').trim())
  const minor = decimal ? Number(decimal[1]) * 100 + Number((decimal[2] ?? '').padEnd(2, '0')) : 0
  if (!text || [...text].length > 1000) {
    formError.value = 'Введіть опис довжиною від 1 до 1000 символів.'
    return
  }
  if (minor < 1 || minor > 999_999_999_999) {
    formError.value = 'Введіть суму від 0,01 до 9 999 999 999,99 грн, до двох знаків після коми.'
    return
  }

  if (!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(entryDate.value)) {
    formError.value = 'Виберіть дату операції у межах 2000–2099 років.'
    return
  }

  const payload = { kind: isIncome.value ? 'income' : 'expense', description: text, amount_minor: minor, entry_date: entryDate.value }
  const editId = editingId.value
  const key = editId ? null : JSON.stringify(payload)
  const id = key === null ? editId : (pendingIds.get(key) ?? crypto.randomUUID())
  if (key !== null && id !== null) pendingIds.set(key, id)
  saving.value = true
  try {
    const entry = await request<Entry>({
      method: editId ? 'PATCH' : 'POST',
      body: editId ? payload : { id, ...payload },
    }, editId ? `${entriesPath}/${encodeURIComponent(editId)}` : entriesPath)
    if (auth.user?.id !== adminId || !canAccessShopBalance(auth.user) || lifetime.signal.aborted) return
    if (key !== null) pendingIds.delete(key)
    clearDraft()
    entryFormOpen.value = false
    notice.value = editId ? 'Запис оновлено.' : 'Запис збережено.'
    month.value = effectiveDate(entry).slice(0, 7)
    day.value = ''
    filterKind.value = ''
    await loadEntries()
  } catch (error) {
    if (auth.user?.id !== adminId || !canAccessShopBalance(auth.user) || lifetime.signal.aborted || handleAccessError(error)) return
    if (statusCode(error) === 409) {
      if (key !== null) pendingIds.delete(key)
      formError.value = 'Конфлікт запису. Перевірте журнал і спробуйте ще раз.'
    } else if (editId && statusCode(error) === 404) {
      formError.value = 'Запис не знайдено або редагування ще недоступне.'
    } else {
      formError.value = 'Не вдалося підтвердити збереження. Спробуйте ще раз.'
    }
  } finally {
    if (auth.user?.id === adminId) saving.value = false
  }
}

function confirmDeletion(entry: Entry) {
  selectedEntry.value = null
  deleteError.value = ''
  entryToDelete.value = entry
}

async function deleteEntry() {
  const entry = entryToDelete.value
  if (!entry || deleting.value || saving.value || !granted.value || !canAccessShopBalance(auth.user)) return
  deleting.value = true
  deleteError.value = ''
  notice.value = ''
  try {
    await request({ method: 'DELETE' }, `${entriesPath}/${encodeURIComponent(entry.id)}`)
    if (entryToDelete.value !== entry || lifetime.signal.aborted) return
    entryToDelete.value = null
    notice.value = 'Запис видалено.'
    await loadEntries()
  } catch (error) {
    if (entryToDelete.value !== entry || lifetime.signal.aborted || handleAccessError(error)) return
    deleteError.value = [404, 405, 501].includes(statusCode(error) ?? 0)
      ? 'Запис не знайдено або видалення ще недоступне.'
      : 'Не вдалося видалити запис. Спробуйте ще раз.'
  } finally {
    deleting.value = false
  }
}

watch([() => auth.user?.id, () => canAccessShopBalance(auth.user)], () => {
  clearJournal()
  void loadEntries()
}, { flush: 'sync' })

onMounted(loadEntries)

onScopeDispose(() => {
  lifetime.abort()
  clearJournal()
})
</script>

<template>
  <div v-if="canAccessShopBalance(auth.user)" class="space-y-3 sm:space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-lg font-semibold sm:text-2xl">Загальний баланс</h1>
      <BaseButton v-if="granted" variant="primary" size="sm" :disabled="loading || saving" @click="openEntryForm()">
        <PlusIcon class="h-4 w-4" aria-hidden="true" />
        Додати запис
      </BaseButton>
    </header>

    <p v-if="notice" role="status">{{ notice }}</p>

    <div class="space-y-3">
      <template v-if="granted">
        <BaseCard as="section" padding="sm" class="space-y-2">
          <h2 class="text-base font-semibold">Період</h2>
          <div class="grid grid-cols-2 gap-2">
            <BaseCalendar :model-value="month" label="Місяць журналу" menu-class="min-w-56" mode="month" placeholder="Оберіть місяць" input-class="base-control w-full py-2 pr-1 text-xs sm:text-sm" min="2000-01" max="2099-12" :disabled="saving"
              @update:model-value="month = String($event ?? ''); day = ''; loadEntries()" />
            <BaseCalendar :model-value="comparison" label="Порівняння" menu-class="right-0 min-w-56" mode="month" placeholder="Оберіть місяць" input-class="base-control w-full py-2 pr-1 text-xs sm:text-sm" min="2000-01" max="2099-12" :disabled="saving"
              @update:model-value="comparison = String($event ?? ''); loadEntries()" />
          </div>
          <BaseButton v-if="comparison" variant="outline" size="sm" :disabled="saving" @click="comparison = ''; loadEntries()">
            Прибрати порівняння
          </BaseButton>
        </BaseCard>
      </template>

      <p v-if="loading" role="status">Завантажуємо журнал…</p>
      <div v-else-if="loadError" class="space-y-3">
        <p role="alert">{{ loadError }}</p>
        <BaseButton variant="outline" @click="loadEntries">Оновити журнал</BaseButton>
      </div>

      <template v-else-if="granted">
        <BaseCard as="section" padding="sm" class="space-y-2">
          <h2 class="text-base font-semibold">Історія записів</h2>
          <div class="balance-filters grid grid-cols-2 items-start gap-2 sm:grid-cols-3">
            <BaseSelect :model-value="day" @update:model-value="day = String($event ?? '')" label="День" :options="[{ value: '', label: 'Усі дні' }, ...days.map(value => ({ value, label: value }))]">
              <template #icon><CalendarDaysIcon class="h-4 w-4" aria-hidden="true" /></template>
            </BaseSelect>
            <BaseSelect :model-value="filterKind" @update:model-value="filterKind = String($event ?? '')" label="Тип" :options="[
              { value: '', label: 'Усі типи' },
              { value: 'income', label: 'Дохід' }, { value: 'expense', label: 'Витрата' },
            ]">
              <template #icon><FunnelIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template>
            </BaseSelect>
            <BaseSelect field-class="base-field col-span-2 space-y-1.5 text-sm sm:col-span-1" :model-value="sort" @update:model-value="sort = String($event ?? '')" label="Сортування" :options="[
              { value: 'newest', label: 'Спочатку нові' }, { value: 'oldest', label: 'Спочатку старі' },
            ]">
              <template #icon><ArrowsUpDownIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template>
            </BaseSelect>
          </div>
          <BaseTable
            caption="Історія записів"
            :empty="!visibleEntries.length"
            empty-title="За вибраними умовами записів немає"
            min-width="0"
            table-class="table-fixed balance-history"
            wrapper-class="balance-history-wrapper"
            dense
          >
            <template #head>
              <tr>
                <th scope="col" class="w-[15%] sm:w-[19%]">Дата</th>
                <th scope="col" class="w-[10%] sm:w-[13%]">Тип</th>
                <th scope="col">Опис</th>
                <th scope="col" class="balance-amount w-[27%] sm:w-[18%]">Сума</th>
                <th scope="col" class="hidden w-[20%] sm:table-cell">Автор</th>
                <th scope="col" class="w-[4.5rem] sm:w-24"><span class="sr-only sm:not-sr-only">Дії</span></th>
              </tr>
            </template>
            <tr v-for="entry in visibleEntries" :key="entry.id">
              <td class="whitespace-nowrap">
                <time :datetime="entry.day">
                  <span class="sm:hidden">{{ compactDateFormat.format(new Date(entry.day + 'T12:00:00Z')) }}</span>
                  <span class="hidden sm:inline">{{ entry.day }}</span>
                </time>
              </td>
              <td class="whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 font-medium" :class="entry.kind === 'income' ? 'balance-income' : 'balance-expense'">
                  <component :is="entry.kind === 'income' ? ArrowUpRightIcon : ArrowDownRightIcon" class="h-4 w-4" aria-hidden="true" />
                  <span class="sr-only sm:not-sr-only">{{ entry.kind === 'income' ? 'Дохід' : 'Витрата' }}</span>
                </span>
              </td>
              <td>
                <BaseButton
                  class="block w-full min-w-0 truncate text-left underline decoration-dotted underline-offset-2"
                  aria-haspopup="dialog"
                  @click="selectedEntry = entry"
                >
                  {{ entry.description }}
                </BaseButton>
              </td>
              <td class="balance-amount break-words tabular-nums">
                {{ money(entry.kind === 'income' ? entry.amount_minor : -entry.amount_minor) }}
              </td>
              <td class="hidden break-all sm:table-cell">{{ entry.author_email }}</td>
              <td>
                <div class="flex justify-end gap-1">
                  <BaseButton variant="icon" class="!h-7 !w-7 shrink-0 !rounded-full" :disabled="saving || deleting" aria-label="Редагувати запис" title="Редагувати" @click="openEntryForm(entry)">
                    <PencilIcon class="h-4 w-4" aria-hidden="true" />
                  </BaseButton>
                  <BaseButton variant="danger-icon" class="!h-7 !w-7 shrink-0 !rounded-full" :disabled="saving || deleting" aria-label="Видалити запис" title="Видалити" @click="confirmDeletion(entry)">
                    <TrashIcon class="h-4 w-4" aria-hidden="true" />
                  </BaseButton>
                </div>
              </td>
            </tr>
          </BaseTable>
        </BaseCard>

        <BaseCard as="section" padding="sm" class="space-y-2">
          <h2 class="text-base font-semibold">Підсумки за місяцями</h2>
          <BaseTable caption="Підсумки за місяцями" :empty="!monthlyTotals.length" empty-title="За цей період записів немає" min-width="25rem" table-class="balance-totals" dense>
            <template #head>
              <tr>
                <th scope="col">Місяць</th>
                <th scope="col">
                  <span class="balance-income inline-flex items-center gap-1">
                    <ArrowUpRightIcon class="hidden h-4 w-4 sm:block" aria-hidden="true" /> Доходи
                  </span>
                </th>
                <th scope="col">
                  <span class="balance-expense inline-flex items-center gap-1">
                    <ArrowDownRightIcon class="hidden h-4 w-4 sm:block" aria-hidden="true" /> Витрати
                  </span>
                </th>
                <th scope="col">Різниця</th>
              </tr>
            </template>
            <tr v-for="[period, totals] in monthlyTotals" :key="period" class="tabular-nums">
              <td class="break-words">{{ period }}</td>
              <td class="balance-income whitespace-nowrap">{{ money(totals.income) }}</td>
              <td class="balance-expense whitespace-nowrap">{{ money(totals.expense) }}</td>
              <td class="whitespace-nowrap font-semibold" :class="netTone(totals)">
                {{ money(totals.income - totals.expense) }}
              </td>
            </tr>
          </BaseTable>
        </BaseCard>
      </template>
    </div>
    <BaseModal
      v-model="entryFormOpen"
      :aria-label="entryFormTitle"
      max-width-class="max-w-lg"
      :close-on-backdrop="!saving"
      :close-on-escape="!saving"
    >
      <template #head><h2 class="text-base font-semibold">{{ entryFormTitle }}</h2></template>
      <template #body="{ close }">
        <form class="space-y-3" @submit.prevent="saveEntry">
          <fieldset class="flex flex-wrap gap-4" :disabled="saving">
            <legend class="mb-2 text-sm font-medium">Тип запису</legend>
            <BaseRadioButton :model-value="isIncome" @update:model-value="isIncome = $event === true" name="entry-kind" :value="false" >
              <span class="balance-expense inline-flex items-center gap-1.5 font-medium">
                <ArrowDownRightIcon class="h-4 w-4" aria-hidden="true" />
                Витрата
              </span>
            </BaseRadioButton>
            <BaseRadioButton :model-value="isIncome" @update:model-value="isIncome = $event === true" name="entry-kind" :value="true" >
              <span class="balance-income inline-flex items-center gap-1.5 font-medium">
                <ArrowUpRightIcon class="h-4 w-4" aria-hidden="true" />
                Дохід
              </span>
            </BaseRadioButton>
          </fieldset>
          <div class="grid gap-3">
            <BaseCalendar v-model="entryDate" label="Дата операції" min="2000-01-01" max="2099-12-31"
              input-class="base-control w-full py-2 pr-2 text-sm" required :disabled="saving" />
            <BaseTextarea v-model="description" label="Опис" :rows="3" required :disabled="saving">
              <template #icon><DocumentTextIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template>
            </BaseTextarea>
            <BaseInput v-model="amount" label="Сума, грн" inputmode="decimal" placeholder="0,00" required :disabled="saving">
              <template #icon><BanknotesIcon class="h-4 w-4 shrink-0" aria-hidden="true" /></template>
            </BaseInput>
          </div>
          <p v-if="formError" role="alert">{{ formError }}</p>
          <div class="flex flex-wrap justify-end gap-2">
            <BaseButton variant="outline" :disabled="saving" @click="close">Скасувати</BaseButton>
            <BaseButton type="submit" variant="primary" :loading="saving" :disabled="loading">Зберегти</BaseButton>
          </div>
        </form>
      </template>
    </BaseModal>

    <BaseModal
      :model-value="selectedEntry !== null"
      aria-label="Опис запису"
      max-width-class="max-w-lg"
      @update:model-value="selectedEntry = null"
    >
      <template #head><h2 class="text-base font-semibold">Опис запису</h2></template>
      <template #body="{ close }">
        <div v-if="selectedEntry" class="space-y-3">
          <p class="whitespace-pre-wrap break-words">{{ selectedEntry.description }}</p>
          <p class="break-words text-sm text-ui-muted">
            {{ selectedEntry.author_email }} · {{ timeFormat.format(new Date(selectedEntry.created_at)) }}
          </p>
          <p v-if="selectedEntry.updated_at" class="break-words text-sm text-ui-muted">
            Відредаговано {{ timeFormat.format(new Date(selectedEntry.updated_at)) }}
            <span v-if="selectedEntry.updated_by_email"> · {{ selectedEntry.updated_by_email }}</span>
          </p>
          <div class="flex flex-wrap gap-2">
            <BaseButton variant="primary" :disabled="loading || saving" @click="openEntryForm(selectedEntry)">
              <PencilIcon class="h-4 w-4" aria-hidden="true" /> Редагувати
            </BaseButton>
            <BaseButton variant="danger-outline" :disabled="deleting || saving" @click="confirmDeletion(selectedEntry)">
              <TrashIcon class="h-4 w-4" aria-hidden="true" /> Видалити
            </BaseButton>
            <BaseButton variant="secondary" @click="close">Закрити</BaseButton>
          </div>
        </div>
      </template>
    </BaseModal>
    <BaseModal
      :model-value="entryToDelete !== null"
      aria-label="Видалити запис?"
      max-width-class="max-w-lg"
      :close-on-backdrop="!deleting"
      :close-on-escape="!deleting"
      @update:model-value="!deleting && (entryToDelete = null)"
    >
      <template #head><h2 class="text-base font-semibold">Видалити запис?</h2></template>
      <template #body="{ close }">
        <div class="space-y-3">
          <p class="break-words">{{ entryToDelete?.description }}</p>
          <p v-if="deleteError" role="alert">{{ deleteError }}</p>
          <div class="flex flex-wrap justify-end gap-2">
            <BaseButton variant="secondary" :disabled="deleting" @click="close">Скасувати</BaseButton>
            <BaseButton variant="danger" :loading="deleting" @click="deleteEntry">Видалити</BaseButton>
          </div>
        </div>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.balance-filters :deep(.base-field__label) {
  display: flex;
  align-items: center;
  min-height: 1.25rem;
  line-height: 1.25rem;
}

:deep(.balance-history-wrapper .base-table__mobile-hint) { display: none; }
:deep(.balance-history-wrapper .base-table__scroll) { scrollbar-gutter: auto; }
:deep(.balance-history) :is(th, td).balance-amount { text-align: right; }
:deep(.balance-totals) :is(th, td) { text-align: center; }

@media (max-width: 639px) {
  :deep(.balance-history-wrapper .balance-history) :is(th, td) { padding: .375rem .25rem; font-size: .75rem; }
}
.balance-income { color: var(--bo-success-text); }
.balance-expense { color: var(--bo-danger-text); }
</style>

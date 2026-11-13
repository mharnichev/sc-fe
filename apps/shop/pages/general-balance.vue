<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'Загальний баланс' })

type Kind = 'income' | 'expense'
type Entry = {
  id: string
  kind: Kind
  description: string
  amount_minor: number
  author_email: string
  created_at: string
}
type Totals = Record<Kind, bigint>

const timeZone = 'Europe/Kyiv'
const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormat = new Intl.DateTimeFormat('uk-UA', { timeZone, dateStyle: 'medium', timeStyle: 'short' })
const currencyFormat = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' })
const monthPattern = /^20\d{2}-(0[1-9]|1[0-2])$/
const apiBase = useRuntimeConfig().public.apiBase
const lifetime = new AbortController()

const email = ref('')
const password = ref('')
let session: { token: string } | undefined
const access = ref<'login' | 'checking' | 'granted'>('login')
const signingIn = ref(false)
const loading = ref(false)
const saving = ref(false)
const accessError = ref('')
const loadError = ref('')
const formError = ref('')
const notice = ref('')
const month = ref(dayFormat.format(new Date()).slice(0, 7))
const comparison = ref('')
const day = ref('')
const filterKind = ref('')
const sort = ref('newest')
const kind = ref<Kind>('expense')
const description = ref('')
const amount = ref('')
const records = shallowRef<Record<string, Entry[]>>({})
const pendingIds = new Map<string, string>()
let loadVersion = 0

const entriesPath = '/shop-balance/entries'
const entries = computed(() => records.value[month.value] ?? [])
const visibleEntries = computed(() => {
  const selected = entries.value.filter(entry =>
    (!day.value || dayFormat.format(new Date(entry.created_at)) === day.value)
    && (!filterKind.value || entry.kind === filterKind.value),
  )
  return sort.value === 'oldest' ? selected.reverse() : selected
})
const days = computed(() => [...new Set(entries.value.map(entry => dayFormat.format(new Date(entry.created_at))))])
const dailyTotals = computed(() => {
  const totals = new Map<string, Totals>()
  for (const entry of entries.value) {
    const date = dayFormat.format(new Date(entry.created_at))
    const row = totals.get(date) ?? { income: BigInt(0), expense: BigInt(0) }
    row[entry.kind] += BigInt(entry.amount_minor)
    totals.set(date, row)
  }
  return [...totals.entries()]
})
const monthlyTotals = computed(() => Object.entries(records.value).map(([period, rows]) => {
  const totals: Totals = { income: BigInt(0), expense: BigInt(0) }
  for (const row of rows) totals[row.kind] += BigInt(row.amount_minor)
  return [period, totals] as const
}))

function money(minor: number | bigint) {
  const value = BigInt(minor)
  const absolute = value < BigInt(0) ? -value : value
  const cents = String(absolute % BigInt(100)).padStart(2, '0')
  return (value < BigInt(0) ? '−' : '') + currencyFormat.formatToParts(absolute / BigInt(100))
    .map(part => part.type === 'fraction' ? cents : part.value).join('')
}

function request<T>(path: string, options: Parameters<typeof $fetch>[1]) {
  return $fetch<T>(path, {
    baseURL: apiBase,
    credentials: 'omit',
    signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(15000)]),
    retry: 0,
    ...options,
  })
}

function statusCode(error: unknown) {
  return (error as { response?: Response } | null)?.response?.status
}

function clearDraft() {
  kind.value = 'expense'
  description.value = ''
  amount.value = ''
  formError.value = ''
}

function endSession(message = '') {
  ++loadVersion
  session = undefined
  records.value = {}
  access.value = 'login'
  accessError.value = message
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
  if (status === 401) endSession('Сеанс завершився. Увійдіть знову.')
  if (status === 403) endSession('Доступ до загального балансу закрито.')
  return status === 401 || status === 403
}

async function loadEntries() {
  const current = session
  if (!current) return
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
      await request<Entry[]>(entriesPath, {
        query: { month: period },
        headers: { Authorization: `Bearer ${current.token}` },
      }).catch((error: unknown) => {
        if (session === current && !lifetime.signal.aborted) handleAccessError(error)
        throw error
      }),
    ] as const))
    if (version !== loadVersion || lifetime.signal.aborted) return
    records.value = Object.fromEntries(results)
    access.value = 'granted'
  } catch {
    if (session !== current || lifetime.signal.aborted) return
    if (version === loadVersion) loadError.value = 'Не вдалося завантажити журнал.'
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

async function signIn() {
  if (signingIn.value) return
  signingIn.value = true
  accessError.value = ''
  const body = new URLSearchParams({ username: email.value.trim(), password: password.value })
  password.value = ''
  try {
    const response = await request<{ access_token: string }>('/shop-balance/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (lifetime.signal.aborted) return
    session = { token: response.access_token }
    access.value = 'checking'
    await loadEntries()
  } catch (error) {
    const status = statusCode(error)
    accessError.value = status === 401 ? 'Перевірте email і пароль.'
      : status === 403 ? 'Доступ до загального балансу закрито.' : 'Не вдалося увійти. Спробуйте ще раз.'
  } finally {
    signingIn.value = false
  }
}

async function saveEntry() {
  const current = session
  if (!current || saving.value || loading.value || access.value !== 'granted') return
  formError.value = ''
  notice.value = ''
  const text = description.value.trim()
  const decimal = /^(\d{1,10})(?:[,.](\d{1,2}))?$/.exec(amount.value.trim())
  const minor = decimal ? Number(decimal[1]) * 100 + Number((decimal[2] ?? '').padEnd(2, '0')) : 0
  if (!text || [...text].length > 1000) {
    formError.value = 'Введіть опис довжиною від 1 до 1000 символів.'
    return
  }
  if (minor < 1 || minor > 999_999_999_999) {
    formError.value = 'Введіть суму від 0,01 до 9 999 999 999,99 грн, до двох знаків після коми.'
    return
  }

  const payload = { kind: kind.value, description: text, amount_minor: minor }
  const key = JSON.stringify(payload)
  const id = pendingIds.get(key) ?? crypto.randomUUID()
  pendingIds.set(key, id)
  saving.value = true
  try {
    const entry = await request<Entry>(entriesPath, {
      method: 'POST',
      headers: { Authorization: `Bearer ${current.token}` },
      body: { id, ...payload },
    })
    if (session !== current || lifetime.signal.aborted) return
    pendingIds.delete(key)
    clearDraft()
    notice.value = 'Запис збережено.'
    month.value = dayFormat.format(new Date(entry.created_at)).slice(0, 7)
    day.value = ''
    filterKind.value = ''
    await loadEntries()
  } catch (error) {
    if (session !== current || lifetime.signal.aborted || handleAccessError(error)) return
    if (statusCode(error) === 409) {
      pendingIds.delete(key)
      formError.value = 'Конфлікт запису. Перевірте журнал перед створенням нового запису.'
    } else {
      formError.value = 'Не вдалося підтвердити збереження. Спробуйте ще раз.'
    }
  } finally {
    if (session === current) saving.value = false
  }
}

onScopeDispose(() => {
  lifetime.abort()
  endSession()
})
</script>

<template>
  <main class="balance">
    <header class="balance__header">
      <h1>Загальний баланс</h1>
      <BaseButton v-if="access !== 'login'" variant="outline-dark" @click="endSession()">Вийти</BaseButton>
    </header>

    <form v-if="access === 'login'" class="balance__panel balance__login" @submit.prevent="signIn">
      <h2>Вхід адміністратора</h2>
      <BaseInput v-model="email" label="Email" type="email" autocomplete="username" required :disabled="signingIn" />
      <BaseInput v-model="password" label="Пароль" type="password" autocomplete="current-password" required :disabled="signingIn" />
      <p v-if="accessError" role="alert">{{ accessError }}</p>
      <BaseButton type="submit" :loading="signingIn">Увійти</BaseButton>
    </form>

    <div v-else class="balance__stack">
      <template v-if="access === 'granted'">
        <form class="balance__panel" @submit.prevent="saveEntry">
          <h2>Новий запис</h2>
          <fieldset class="balance__choices" :disabled="saving">
            <legend>Тип запису</legend>
            <BaseRadio v-model="kind" name="entry-kind" value="expense" label="Витрата" />
            <BaseRadio v-model="kind" name="entry-kind" value="income" label="Дохід" />
          </fieldset>
          <div class="balance__fields">
            <BaseTextarea v-model="description" rule="plain" label="Опис" :rows="3" required :disabled="saving" />
            <BaseInput v-model="amount" label="Сума, грн" inputmode="decimal" placeholder="0,00" required :disabled="saving" />
          </div>
          <p v-if="formError" role="alert">{{ formError }}</p>
          <p v-if="notice" role="status">{{ notice }}</p>
          <BaseButton type="submit" :loading="saving" :disabled="loading">Зберегти</BaseButton>
        </form>

        <section class="balance__panel">
          <h2>Період</h2>
          <div class="balance__fields">
            <BaseInput v-model="month" label="Місяць журналу" type="month" min="2000-01" max="2099-12" :disabled="saving"
              @update:model-value="day = ''; loadEntries()" />
            <BaseInput v-model="comparison" label="Місяць для порівняння" type="month" min="2000-01" max="2099-12" :disabled="saving"
              @update:model-value="loadEntries" />
          </div>
          <BaseButton v-if="comparison" variant="outline-dark" :disabled="saving" @click="comparison = ''; loadEntries()">
            Прибрати порівняння
          </BaseButton>
        </section>
      </template>

      <p v-if="loading" role="status">Завантажуємо журнал…</p>
      <div v-else-if="loadError" class="balance__panel">
        <p role="alert">{{ loadError }}</p>
        <BaseButton variant="outline-dark" @click="loadEntries">Оновити журнал</BaseButton>
      </div>

      <template v-else-if="access === 'granted'">
        <section class="balance__panel">
          <h2>Історія записів</h2>
          <div class="balance__fields">
            <BaseSelect v-model="day" label="День" placeholder="Усі дні" :options="days.map(value => ({ value, label: value }))" />
            <BaseSelect v-model="filterKind" label="Тип" placeholder="Усі типи" :options="[
              { value: 'income', label: 'Дохід' }, { value: 'expense', label: 'Витрата' },
            ]" />
            <BaseSelect v-model="sort" label="Сортування" :options="[
              { value: 'newest', label: 'Спочатку нові' }, { value: 'oldest', label: 'Спочатку старі' },
            ]" />
          </div>
          <p v-if="!visibleEntries.length">За вибраними умовами записів немає.</p>
          <ul v-else class="balance__stack">
            <li v-for="entry in visibleEntries" :key="entry.id" class="balance__entry">
              <div class="balance__entry-head">
                <strong>{{ entry.kind === 'income' ? 'Дохід' : 'Витрата' }}</strong>
                <strong>{{ money(entry.kind === 'income' ? entry.amount_minor : -entry.amount_minor) }}</strong>
              </div>
              <p class="balance__description">{{ entry.description }}</p>
              <p class="balance__meta">
                {{ entry.author_email }} · <time :datetime="entry.created_at">{{ timeFormat.format(new Date(entry.created_at)) }}</time>
              </p>
            </li>
          </ul>
        </section>

        <section v-for="table in [
          { title: 'Підсумки за днями', period: 'День', rows: dailyTotals },
          { title: 'Підсумки за місяцями', period: 'Місяць', rows: monthlyTotals },
        ]" :key="table.title" class="balance__panel">
          <h2>{{ table.title }}</h2>
          <p v-if="!table.rows.length">За цей період записів немає.</p>
          <table v-else :aria-label="table.title">
            <thead>
              <tr>
                <th scope="col">{{ table.period }}</th>
                <th scope="col">Доходи</th>
                <th scope="col">Витрати</th>
                <th scope="col">Різниця</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="[period, totals] in table.rows" :key="period">
                <th scope="row">{{ period }}</th>
                <td>{{ money(totals.income) }}</td>
                <td>{{ money(totals.expense) }}</td>
                <td>{{ money(totals.income - totals.expense) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>
    </div>
  </main>
</template>

<style scoped>
.balance {
  width: min(100% - 2rem, 60rem);
  margin-inline: auto;
  padding-block: 2rem 4rem;
}

.balance__header,
.balance__entry-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: .75rem;
}

.balance__header { margin-bottom: 1.5rem; }
.balance h1 { font-size: clamp(1.65rem, 5vw, 2.5rem); font-weight: 700; }
.balance h2 { font-size: 1.25rem; font-weight: 700; }

.balance__stack,
.balance__panel {
  display: grid;
  gap: 1rem;
}

.balance__panel,
.balance__entry {
  border: 1px solid #d4d4d4;
  border-radius: .75rem;
  padding: clamp(.75rem, 3vw, 1.5rem);
}

.balance__panel { justify-items: start; }
.balance__panel > :is(.balance__fields, table, ul, fieldset) { width: 100%; }
.balance__login { max-width: 28rem; justify-items: stretch; }
.balance__fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: 1rem; }

.balance__choices {
  display: flex;
  flex-wrap: wrap;
  gap: .75rem 1.5rem;
}

.balance__choices legend { margin-bottom: .5rem; }
.balance__entry { display: grid; gap: .4rem; overflow-wrap: anywhere; }
.balance__description { white-space: pre-wrap; }
.balance__meta { font-size: .875rem; color: #505050; }
.balance [role='alert'] { color: #a12824; }

.balance table { text-align: right; font-variant-numeric: tabular-nums; table-layout: fixed; }
.balance :is(th, td) { border-bottom: 1px solid #d4d4d4; padding: .6rem .15rem; overflow-wrap: anywhere; }
.balance th:first-child { text-align: left; }
</style>

<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/outline'

interface OperationsWatch {
  observed_at: string
  counts: Record<string, number>
  total: number
  truncated: boolean
  background_process: {
    role: string
    state: string
    last_error_code: string | null
    scheduler_names?: string[]
  }
}

const auth = useAuthStore()
const api = useApi({ refreshOnUnauthorized: false })
const snapshot = shallowRef<OperationsWatch | null>(null)
const loading = ref(false)
const error = ref('')
const identity = () => JSON.stringify([auth.user?.id, auth.sessionRevision, auth.accessToken])
let generation = 0
let active = true
const refresh = async () => {
  if (!auth.user?.id || !auth.accessToken || loading.value || !active) return
  const started = ++generation
  const session = identity()
  const current = () => active && started === generation && session === identity()
  loading.value = true
  error.value = ''
  snapshot.value = null
  try {
    const value = await api<OperationsWatch>('/backoffice/shop-operations-watch', { method: 'GET', retry: 0 })
    if (!current()) return
    if (!value?.background_process || typeof value.background_process.role !== 'string' || typeof value.background_process.state !== 'string'
      || (value.background_process.last_error_code !== null && typeof value.background_process.last_error_code !== 'string')
      || typeof value.observed_at !== 'string' || !Number.isFinite(Date.parse(value.observed_at))
      || !Number.isSafeInteger(value.total) || value.total < 0 || !value.counts || typeof value.counts !== 'object' || Array.isArray(value.counts)
      || Object.values(value.counts).some(count => !Number.isSafeInteger(count) || count < 0)
      || (value.background_process.scheduler_names !== undefined && (!Array.isArray(value.background_process.scheduler_names)
        || value.background_process.scheduler_names.some(name => typeof name !== 'string')))) throw new Error('Invalid watch response')
    snapshot.value = value
  }
  catch (cause) {
    if (!current()) return
    const failure = cause as { statusCode?: number, response?: { status?: number } }
    const status = failure.response?.status ?? failure.statusCode
    error.value = status === 403 ? 'Немає прав на операційний і фіскальний нагляд.'
      : status === 401 ? 'Сесія недійсна. Увійдіть у backoffice повторно.'
        : 'Не вдалося отримати стан операцій.'
  }
  finally { if (current()) loading.value = false }
}
watch(identity, () => {
  generation++
  snapshot.value = null
  error.value = ''
  loading.value = false
  if (import.meta.client && auth.user?.id && auth.accessToken) void refresh()
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { active = false; generation++ })
const counts = computed(() => Object.entries(snapshot.value?.counts || {}).sort(([a], [b]) => a.localeCompare(b)))
</script>

<template>
  <main class="space-y-6" :aria-busy="loading || undefined">
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-semibold text-ui-primary">Операційний нагляд магазину</h1>
      <BaseButton type="button" variant="icon" :disabled="loading || !auth.user || !auth.accessToken" title="Оновити спостереження" aria-label="Оновити спостереження" @click="refresh">
        <ArrowPathIcon class="h-5 w-5" :class="{ 'animate-spin': loading }" aria-hidden="true" />
      </BaseButton>
    </header>
    <p v-if="error" role="alert" class="text-ui-danger">{{ error }}</p>
    <BaseLoader v-if="loading" label="Завантаження стану операцій…" />
    <template v-else-if="snapshot">
      <section class="space-y-3" aria-label="Процес відповіді API">
        <h2 class="text-lg font-semibold text-ui-primary">Процес відповіді API</h2>
        <dl class="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
          <div><dt class="text-ui-muted">role</dt><dd><BaseBadge>{{ snapshot.background_process.role }}</BaseBadge></dd></div>
          <div><dt class="text-ui-muted">state</dt><dd><BaseBadge>{{ snapshot.background_process.state }}</BaseBadge></dd></div>
          <div><dt class="text-ui-muted">error</dt><dd class="break-words text-ui-primary">{{ snapshot.background_process.last_error_code ?? 'Немає' }}</dd></div>
          <div><dt class="text-ui-muted">observed_at</dt><dd class="break-words text-ui-primary"><time :datetime="snapshot.observed_at">{{ snapshot.observed_at }}</time></dd></div>
          <div class="min-w-0 sm:col-span-2"><dt class="text-ui-muted">scheduler_names</dt><dd class="text-ui-primary">
            <span v-if="snapshot.background_process.scheduler_names === undefined">Не надано сервером</span>
            <span v-else-if="!snapshot.background_process.scheduler_names.length">Немає</span>
            <ul v-else class="space-y-1"><li v-for="name in snapshot.background_process.scheduler_names" :key="name" class="break-all">{{ name }}</li></ul>
          </dd></div>
        </dl>
      </section>
      <section class="space-y-3" aria-label="Лічильники операцій">
        <h2 class="text-lg font-semibold text-ui-primary">Лічильники операцій</h2>
        <p class="text-sm text-ui-secondary">Усього: <strong>{{ snapshot.total }}</strong></p>
        <BaseTable caption="Лічильники операцій" min-width="22rem" :empty="!counts.length" empty-title="Лічильників немає">
          <template #head><tr><th>Причина</th><th>Кількість</th></tr></template>
          <tr v-for="[reason, count] in counts" :key="reason"><td class="break-all">{{ reason }}</td><td>{{ count }}</td></tr>
        </BaseTable>
      </section>
    </template>
  </main>
</template>

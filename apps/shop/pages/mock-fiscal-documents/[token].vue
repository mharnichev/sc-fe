<script setup lang="ts">
definePageMeta({ layout: false })
interface PublicMockDocument { kind: 'sale' | 'return', items: Array<{ name: string | null, quantity: number, total_minor: number }>, amount_minor: number, currency: 'UAH', notice: string, simulation: true, is_sent_dps: false }
const route = useRoute(), config = useRuntimeConfig()
const document = shallowRef<PublicMockDocument | null>(null), error = ref(''), loading = ref(false)
let generation = 0
const load = async () => {
  const current = ++generation, token = String(route.params.token || '')
  document.value = null; error.value = ''; loading.value = true
  try {
    if (!/^[A-Za-z0-9._~-]{20,2048}$/.test(token)) throw new Error('invalid capability')
    const result = await $fetch<PublicMockDocument>(`/public/mock-fiscal-documents/${encodeURIComponent(token)}`, { baseURL: import.meta.server ? config.apiBase : config.public.apiBase, retry: 0, credentials: 'omit', referrerPolicy: 'no-referrer' })
    if (current !== generation || String(route.params.token || '') !== token) return
    if (result.simulation !== true || result.is_sent_dps !== false || !['sale', 'return'].includes(result.kind) || result.currency !== 'UAH' || !Array.isArray(result.items) || (!Number.isSafeInteger(result.amount_minor) || result.amount_minor < 0) || typeof result.notice !== 'string' || result.items.some(item => !item || (item.name !== null && typeof item.name !== 'string') || !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !Number.isSafeInteger(item.total_minor) || item.total_minor < 0)) throw new Error('invalid mock document')
    // Render only the public DTO. Extra server fields never become visible.
    document.value = { kind: result.kind, items: result.items.map(item => ({ name: item.name, quantity: item.quantity, total_minor: item.total_minor })), amount_minor: result.amount_minor, currency: 'UAH', notice: result.notice, simulation: true, is_sent_dps: false }
  } catch { if (current === generation) error.value = 'Посилання MOCK недоступне, відкликане або строк його дії закінчився.' }
  finally { if (current === generation) loading.value = false }
}
watch(() => route.params.token, () => { if (import.meta.client) void load() }, { immediate: true })
onMounted(() => { if (!loading.value && !document.value && !error.value) void load() })
useHead({ title: 'Тестовий документ MOCK', meta: [{ name: 'robots', content: 'noindex,nofollow,noarchive' }, { name: 'referrer', content: 'no-referrer' }] })
const money = (amount: number) => `${(amount / 100).toFixed(2)} грн`
</script>
<template><main class="mock-document"><h1>Тестовий документ MOCK</h1><p>Локальна симуляція. Не є фактичним фіскальним чеком. До ДПС не надсилалось.</p><p v-if="loading">Завантаження MOCK…</p><p v-if="error" role="alert">{{ error }}</p><article v-if="document"><h2>{{ document.kind === 'return' ? 'Повернення MOCK' : 'Продаж MOCK' }}</h2><ul><li v-for="(item, index) in document.items" :key="index">{{ item.name || 'Товар' }} · {{ item.quantity }} · {{ money(item.total_minor) }}</li></ul><p>Сума MOCK: {{ money(document.amount_minor) }}</p><p>{{ document.notice }}</p></article><BaseButton :disabled="loading" @click="load">Оновити MOCK документ</BaseButton></main></template>
<style scoped>.mock-document{display:grid;gap:1rem;max-width:44rem;margin:2rem auto;padding:1rem}.mock-document h1{font-size:1.5rem;font-weight:800}.mock-document article{display:grid;gap:1rem;border:1px solid #ccc;padding:1rem}</style>

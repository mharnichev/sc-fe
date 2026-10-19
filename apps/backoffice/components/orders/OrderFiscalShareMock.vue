<script setup lang="ts">
import type { FiscalMockDocument, MockFiscalShare } from '~/composables/useBackofficeApi'
import { fiscalDefinitiveRejections, localMockFiscalShareUrl } from '~/utils/fiscalMock'
const props = defineProps<{ document: FiscalMockDocument }>()
const api = useBackofficeApi(), auth = useAuthStore(), config = useRuntimeConfig()
type ShareIntent = { operation: 'share' | 'revoke-share', expires_in_seconds?: number }
const command = useOrderSalesCommand<ShareIntent>('mock-fiscal-share', () => String(props.document.id), fiscalDefinitiveRejections)
const share = shallowRef<MockFiscalShare | null>(null), confirmed = ref(false), message = ref('')
const permitted = computed(() => auth.user?.is_superuser || (props.document.kind === 'return' ? auth.user?.can_fiscalize_returns : auth.user?.can_fiscalize_sales))
const link = computed(() => localMockFiscalShareUrl(share.value?.url || null, config.public.mockShopBase))
let generation = 0
watch([() => auth.user?.id, () => props.document.id], () => { generation++; share.value = null; confirmed.value = false; message.value = '' }, { immediate: true, flush: 'sync' })
const run = async (operation: ShareIntent['operation']) => {
  if (!permitted.value || command.busy.value || (!command.intent.value && (!confirmed.value || !props.document.allowed_actions.includes(operation === 'share' ? 'share' : 'revoke_share')))) return
  const version = generation, id = props.document.id
  const body = command.intent.value?.body || { operation, ...(operation === 'share' ? { expires_in_seconds: 3600 } : {}) }
  confirmed.value = false
  let result: MockFiscalShare | null = null
  await command.execute(body, async (payload, key) => { const response = await api.shareMockFiscalDocument(id, payload.operation, payload.operation === 'share' ? { expires_in_seconds: payload.expires_in_seconds } : {}, key); result = response; return { id: response.document_id } }, () => {
    if (generation !== version) return
    share.value = result; message.value = result ? (result.revoked ? 'Локальне MOCK посилання відкликано.' : 'Посилання створено лише для локального тестового магазину. Нове посилання анулює попереднє.') : 'Команду підтверджено. Створіть нове посилання для локального показу.'
    command.clear()
  })
}
</script>
<template>
  <div v-if="document.status === 'issued' && permitted" class="space-y-3 border-t pt-3" :aria-label="`Локальне MOCK посилання #${document.id}`">
    <p>Гостьовий показ містить лише вид товару, кількість і суму MOCK. Нічого не надсилається клієнту.</p>
    <BaseCheckbox v-model="confirmed" :disabled="command.busy.value || !!command.intent.value" :label="`Підтверджую явне створення або відкликання локального тестового посилання MOCK документа #${document.id}`" />
    <div class="flex flex-wrap gap-3"><BaseButton v-if="document.allowed_actions.includes('share') && !command.intent.value" :disabled="!confirmed || command.busy.value" @click="run('share')">Створити локальне тестове посилання MOCK</BaseButton><BaseButton v-if="document.allowed_actions.includes('revoke_share') && !command.intent.value" :disabled="!confirmed || command.busy.value" @click="run('revoke-share')">Відкликати локальне тестове посилання MOCK</BaseButton><BaseButton v-if="command.intent.value" :disabled="command.busy.value" @click="run(command.intent.value.body.operation)">Повторити ту саму команду посилання MOCK</BaseButton></div>
    <p v-if="message" role="status">{{ message }}</p><p v-if="share?.expires_at">Дійсне до {{ share.expires_at }} · покоління {{ share.generation }}</p>
    <a v-if="link && !share?.revoked" :href="link" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" class="break-all underline">Локальне тестове посилання MOCK: {{ link }}</a>
    <p v-if="share?.url && !link" role="alert">Адресу локального магазину не підтверджено. Посилання заблоковано.</p><p v-if="command.error.value" role="alert">{{ command.error.value }}</p>
  </div>
</template>

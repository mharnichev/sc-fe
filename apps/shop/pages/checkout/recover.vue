<script setup lang="ts">
import type { ProductDto } from '@shared-types'
import { cartFingerprint, reminderOrderStorageKey, recoveryPrivacyScript } from '~/utils/checkoutReminder'

const domain = useCatalogDomain()
const config = useRuntimeConfig()
const cart = useCartStore()
const auth = useCustomerAuthStore()
const { locale, setLocale } = useShopLocale()
const { formatPrice } = useShopPriceFormatter()
const { productDisplayName } = useProductDisplay()
const token = useState<string>('checkout-recovery-token', () => '')
const ready = ref(false)
const busy = ref(false)
const error = ref(false)
const conflict = ref(false)
const intentBlocked = ref(false)
const confirmed = ref(false)
const items = ref<Array<{ product_id: number, quantity: number, variant?: string, product: ProductDto }>>([])
const changes = ref<string[]>([])
let recoveryKey = ''
let originalCart = ''
let originalScope = ''
const scope = () => auth.isAuthenticated ? `customer:${auth.customer?.id}` : 'guest'
const text = computed(() => locale.value === 'uk' ? {
  title: 'Ваше незавершене оформлення', intro: 'Перевірте збережені товари. Це ще не замовлення.',
  review: 'Переглянути збережені товари', apply: 'Використати ці товари для оформлення',
  confirm: 'Я перевірив(-ла) актуальні товари та погоджуюся замінити товари оформлення в цій вкладці.',
  invalid: 'Посилання недійсне, прострочене або недоступне для цієї сесії. Відкрийте кошик і почніть оформлення знову.',
  changed: 'Кошик або обліковий запис змінився. Перегляньте товари ще раз.', updates: 'Перевірте актуальну ціну та наявність кожного товару нижче.',
  basket: 'Відкрити кошик',
  pending: 'Попередній запит оформлення в цій вкладці ще не вирішено або його стан недоступний. Перейдіть до оформлення, перш ніж відновлювати товари.',
} : {
  title: 'Your unfinished checkout', intro: 'Review the saved items. This is not an order yet.',
  review: 'Review saved items', apply: 'Use these items for checkout',
  confirm: 'I reviewed the current items and agree to replace the checkout items in this tab.',
  invalid: 'This link is invalid, expired or unavailable for this session. Open your basket and start checkout again.',
  changed: 'Your basket or account changed. Review the items again.', updates: 'Check the current price and availability of each item below.',
  basket: 'Open basket',
  pending: 'A previous checkout request in this tab is unresolved or its saved state cannot be verified. Open checkout before restoring items.',
})
const changeText = (change: string) => {
  const [kind, id] = change.split(':')
  const item = items.value.find(item => item.product_id === Number(id))
  const name = item ? productDisplayName(item.product) : `#${id || '?'}`
  const labels = locale.value === 'uk' ? {
    unavailable: 'Товар більше недоступний і не буде відновлений',
    out_of_stock: 'Обрана кількість недоступна', price_changed: 'Ціна змінилася', variant_changed: 'Варіант змінився',
  } : {
    unavailable: 'Item is no longer available and will not be restored',
    out_of_stock: 'Requested quantity is unavailable', price_changed: 'Price changed', variant_changed: 'Variant changed',
  }
  return `${name}: ${labels[kind as keyof typeof labels] || text.value.updates}`
}
const review = async () => {
  if (!ready.value || busy.value || !token.value) { error.value = true; return }
  busy.value = true
  error.value = false
  confirmed.value = false
  conflict.value = false
  originalCart = cartFingerprint(cart.items)
  originalScope = scope()
  const isCurrentSession = auth.captureSession()
  try {
    const result = await domain.recoverCheckout(token.value)
    if (!isCurrentSession()) { conflict.value = true; items.value = []; return }
    recoveryKey = result.checkout_key
    if (scope() !== originalScope || cartFingerprint(cart.items) !== originalCart) { conflict.value = true; items.value = []; return }
    setLocale(result.locale)
    items.value = result.items
    changes.value = result.changes || []
  } catch { error.value = true; items.value = [] }
  finally { busy.value = false }
}
const apply = async () => {
  if (!ready.value || !confirmed.value || !items.value.length || busy.value) return
  if (scope() !== originalScope || cartFingerprint(cart.items) !== originalCart || cart.syncing) { conflict.value = true; confirmed.value = false; return }
  // Explicit, tab-local replacement only. The order service remains authoritative.
  try {
    // Any saved intent is authoritative, even for another scope or malformed JSON.
    // Recovery must never replace the displayed cart while that intent can retry.
    if (sessionStorage.getItem('shop-checkout-intent-v1') !== null) {
      intentBlocked.value = true; confirmed.value = false; return
    }
    sessionStorage.setItem(reminderOrderStorageKey(scope()), recoveryKey)
  }
  catch { intentBlocked.value = true; confirmed.value = false; return }
  intentBlocked.value = false
  cart.setItems(items.value.map(item => ({ product: item.product, quantity: item.quantity })))
  token.value = ''
  await navigateTo('/checkout/purchase')
}
watch(() => auth.sessionRevision, () => {
  if (!ready.value) return
  items.value = []; confirmed.value = false; conflict.value = true; token.value = ''
})
const persistenceReady = useState<boolean>('shop-persistence-ready', () => false)
watch(persistenceReady, value => { ready.value = value; if (value && !token.value) error.value = true }, { immediate: true })
onUnmounted(() => { token.value = '' })
useHead({
  // Executes in the server-rendered head before the router captures its initial URL.
  // The pre plugin immediately moves the capability into private Nuxt state.
  script: [{ key: 'checkout-recovery-privacy', tagPriority: 'critical', innerHTML: recoveryPrivacyScript(config.app.baseURL) }],
  meta: [{ name: 'referrer', content: 'no-referrer' }, { name: 'robots', content: 'noindex, nofollow, noarchive' }],
})
</script>

<template>
  <section style="max-width: 600px; margin: 2rem auto; padding: 1rem">
    <h1>{{ text.title }}</h1>
    <p>{{ text.intro }}</p>
    <p v-if="error" role="alert">{{ text.invalid }}</p>
    <p v-if="conflict" role="alert">{{ text.changed }}</p>
    <p v-if="intentBlocked" role="alert">{{ text.pending }}</p>
    <BaseButton :disabled="!ready || busy || !token" @click="review">{{ text.review }}</BaseButton>
    <template v-if="items.length">
      <p>{{ text.updates }}</p>
      <ul>
        <li v-for="item in items" :key="item.product_id">
          <strong>{{ productDisplayName(item.product) }}</strong> <span v-if="item.variant || item.product.package_size">({{ item.variant || item.product.package_size }})</span> × {{ item.quantity }} — {{ formatPrice(item.product.price) }}
          <span v-if="item.product.is_available_for_purchase === false">{{ locale === 'uk' ? 'Недоступний' : 'Unavailable' }}</span>
        </li>
      </ul>
      <ul v-if="changes.length" role="status"><li v-for="change in changes" :key="change">{{ changeText(change) }}</li></ul>
      <BaseCheckbox id="confirm-recovered-checkout" v-model="confirmed" :label="text.confirm" />
      <BaseButton :disabled="!confirmed || busy || cart.syncing" @click="apply">{{ text.apply }}</BaseButton>
    </template>
    <BaseButton to="/checkout/purchase" variant="text">{{ text.basket }}</BaseButton>
  </section>
</template>

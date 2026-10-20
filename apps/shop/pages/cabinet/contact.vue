<script setup lang="ts">
import type { CustomerOrderDto, PaginatedResponse, ShopFeedbackRequestDto, ShopFeedbackResponseDto } from '@shared-types'
const { runtimeMessage } = useShopRuntimeDisplay()

const auth = useCustomerAuthStore()
const api = useApi()
const { terms, dateLocale } = useShopLocale()
const customer = computed(() => auth.customer)
const form = reactive({
  name: [customer.value?.name, customer.value?.surname].filter(Boolean).join(' '),
  email: customer.value?.email || '',
  topic: 'general' as ShopFeedbackRequestDto['topic'],
  orderReference: '' as string | number,
  text: '',
})
const state = reactive({ loading: false, loadingOrders: false, error: '', done: false })
const orders = ref<CustomerOrderDto[]>([])

watch(customer, value => {
  if (!value) return
  if (!form.name) form.name = [value.name, value.surname].filter(Boolean).join(' ')
  if (!form.email) form.email = value.email || ''
}, { immediate: true })

const topicOptions = computed(() => [
  { value: 'general', label: terms.value.cabinet.contactTopicGeneral },
  { value: 'order', label: terms.value.cabinet.contactTopicOrder },
  { value: 'delivery', label: terms.value.cabinet.contactTopicDelivery },
  { value: 'returns', label: terms.value.cabinet.contactTopicReturns },
  { value: 'product', label: terms.value.cabinet.contactTopicProduct },
  { value: 'other', label: terms.value.cabinet.contactTopicOther },
])

const loadOrders = async () => {
  if (!auth.isAuthenticated) return
  state.loadingOrders = true
  try {
    const response = await api<PaginatedResponse<CustomerOrderDto>>('/public/orders/me', {
      query: { page: 1, page_size: 100 },
    })
    orders.value = response.items
  }
  catch {
    // The message form remains usable if order history cannot be loaded.
  }
  finally {
    state.loadingOrders = false
  }
}

watch(() => auth.isAuthenticated, isAuthenticated => {
  if (isAuthenticated) void loadOrders()
  else orders.value = []
}, { immediate: true })

const submit = async () => {
  state.loading = true
  state.done = false
  state.error = ''
  const payload: ShopFeedbackRequestDto = {
    name: form.name.trim(),
    email: form.email.trim(),
    text: form.text.trim(),
    topic: form.topic,
    ...(form.orderReference ? { orderReference: Number(form.orderReference) } : {}),
  }

  try {
    const response = await api<ShopFeedbackResponseDto>('/public/feedback/email', { method: 'POST', body: payload })
    if (response.message !== 'Feedback accepted') throw new Error('Feedback was not accepted')
    form.text = ''
    form.orderReference = ''
    state.done = true
  }
  catch {
    state.error = terms.value.cabinet.accountContactError
  }
  finally {
    state.loading = false
  }
}

useSeo(() => terms.value.cabinet.contactUs, () => terms.value.cabinet.contactIntro)
</script>

<template>
  <CabinetShell>
    <main class="account-contact">
    <header class="account-contact__heading">
      <p class="account-contact__eyebrow">{{ terms.common.account }}</p>
      <h1>{{ terms.cabinet.contactUs }}</h1>
      <p>{{ terms.cabinet.contactIntro }}</p>
    </header>

    <div class="account-contact__grid">
      <section class="account-contact__details soft-surface">
        <h2>{{ terms.contacts.ourContacts }}</h2>
        <p>{{ terms.contacts.ourContactsText }}</p>
        <a class="account-contact__method soft-surface" href="tel:+380636995730">
          <span class="account-contact__method-icon"><BaseIcon name="phone" size="xxs" /></span>
          <span class="account-contact__method-copy"><small>{{ terms.checkout.phone }}</small><span>+380 63 699 57 30</span></span>
        </a>
        <a class="account-contact__method soft-surface" href="mailto:Soulcutsplace@gmail.com">
          <span class="account-contact__method-icon"><BaseIcon name="email" size="xxs" /></span>
          <span class="account-contact__method-copy"><small>{{ terms.checkout.email }}</small><span>Soulcutsplace@gmail.com</span></span>
        </a>
        <div class="account-contact__schedule"><BaseIcon name="clock" size="xxs" /><span>{{ terms.contacts.schedule }}</span></div>
      </section>

      <form class="account-contact__form" @submit.prevent="submit">
        <BaseInput v-model="form.name" :label="terms.checkout.firstName" required autocomplete="name" />
        <BaseInput v-model="form.email" type="email" :label="terms.checkout.email" required autocomplete="email" />
        <BaseSelect v-model="form.topic" :label="terms.cabinet.contactTopic" :options="topicOptions" required />
        <BaseSelect
          v-if="orders.length"
          v-model="form.orderReference"
          :label="terms.cabinet.contactOrder"
          :placeholder="terms.cabinet.contactOrderPlaceholder"
          :options="orders.map(order => ({ value: order.id, label: `#${order.id} · ${new Date(order.created_at).toLocaleDateString(dateLocale)}` }))"
        />
        <p v-else-if="state.loadingOrders" class="account-contact__hint" role="status">{{ terms.common.loading }}</p>
        <BaseTextarea v-model="form.text" :label="terms.contacts.message" required :rows="5" />
        <BaseButton type="submit" :disabled="state.loading">
          {{ state.loading ? terms.checkout.processing : terms.contacts.send }}
        </BaseButton>
        <p v-if="state.done" class="account-contact__success" role="status">{{ terms.cabinet.accountContactSuccess }}</p>
        <p v-if="state.error" class="account-contact__error" role="alert">{{ runtimeMessage(state.error) }}</p>
      </form>
    </div>
    </main>
  </CabinetShell>
</template>

<style scoped>
.account-contact { display: grid; gap: 1.5rem; min-width: 0; }
.account-contact__heading { display: grid; gap: .5rem; }
.account-contact__heading h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); font-weight: 800; line-height: 1.15; }
.account-contact__heading > p:last-child, .account-contact__details > p { color: #737373; line-height: 1.6; }
.account-contact__eyebrow { color: #737373; font-size: .72rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.account-contact__grid { display: grid; gap: 1rem; min-width: 0; }
.account-contact__details, .account-contact__form { display: grid; align-content: start; gap: 1rem; min-width: 0; padding: 1rem; }
.account-contact__details { align-self: start; gap: .75rem; }
.account-contact__details h2 { font-size: 1.25rem; font-weight: 800; line-height: 1.2; }
.account-contact__details > p { margin-bottom: .5rem; font-size: .875rem; }
.account-contact__method { display: flex; min-width: 0; align-items: center; gap: .75rem; padding: 1rem; color: inherit; text-decoration: none; }
.account-contact__method:focus-visible { outline: 2px solid #0a0a0a; outline-offset: 3px; }
.account-contact__method-icon { display: grid; flex: 0 0 1.5rem; place-items: center; }
.account-contact__method-copy { display: grid; min-width: 0; gap: .25rem; }
.account-contact__method-copy small { color: #737373; font-size: .68rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.account-contact__method-copy > span { overflow-wrap: anywhere; font-size: .9rem; font-weight: 600; line-height: 1.4; }
.account-contact__schedule { display: flex; align-items: center; gap: .65rem; padding: .75rem .25rem 0; color: #737373; font-size: .8rem; }
.account-contact__form :deep(.base-control) { min-width: 0; }
.account-contact__hint { color: #737373; font-size: .85rem; }
.account-contact__success { color: #047857; font-weight: 700; line-height: 1.5; }
.account-contact__error { color: #be123c; font-weight: 700; line-height: 1.5; }
@media (min-width: 900px) { .account-contact__grid { grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); } .account-contact__details, .account-contact__form { padding: 1.25rem; } }
</style>

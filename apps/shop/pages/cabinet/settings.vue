<script setup lang="ts">
const auth = useCustomerAuthStore()
const { terms } = useShopLocale()

const form = reactive({
  name: auth.customer?.name || '',
  surname: auth.customer?.surname || '',
  email: auth.customer?.email || '',
  birthday: auth.customer?.birthday || '',
})
const state = reactive({ loading: false, done: false, error: '' })
const phone = ref(auth.customer?.phone || '')
const otp = reactive({ code: '', target: '', busy: false, error: '', done: false, retryAt: 0, expiresAt: 0, sendsLeft: null as number | null, blocked: false })
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => { clock = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => clearInterval(clock))
const retrySeconds = computed(() => Math.max(0, Math.ceil((otp.retryAt - now.value) / 1000)))
const expired = computed(() => Boolean(otp.target && now.value >= otp.expiresAt))
const canSend = computed(() => !state.loading && !otp.busy && !otp.blocked && otp.sendsLeft !== 0 && retrySeconds.value === 0 && phone.value.trim() !== auth.customer?.phone && /^\+?[\d\s()-]{10,20}$/.test(phone.value.trim()))
watch(phone, () => { otp.target = ''; otp.code = ''; otp.error = ''; otp.done = false }, { flush: 'sync' })

const phoneError = (error: unknown) => {
  const failure = error as { statusCode?: number, status?: number, data?: { detail?: string } }
  const status = failure.statusCode || failure.status
  if (status === 429) {
    const seconds = failure.data?.detail?.match(/Retry in (\d+) seconds/i)?.[1]
    if (seconds) otp.retryAt = Date.now() + (Number(seconds) + 1) * 1000
    else otp.blocked = true
    return terms.value.auth.phoneLimit
  }
  if (status === 409) return terms.value.auth.phoneConflict
  if (status === 401) return terms.value.auth.phoneSessionExpired
  if (status === 400) return terms.value.auth.phoneInvalidCode
  if (status === 422) return terms.value.auth.phoneInvalid
  return terms.value.auth.verifyError
}

const sendPhoneCode = async () => {
  if (!canSend.value) return
  otp.busy = true
  otp.error = ''
  const target = phone.value.trim()
  try {
    const result = await auth.requestPhoneChange(target)
    otp.target = target
    otp.code = ''
    otp.retryAt = Date.now() + result.retry_after_seconds * 1000
    otp.expiresAt = Date.now() + result.expires_in_seconds * 1000
    otp.sendsLeft = result.sends_left_today
    now.value = Date.now()
  }
  catch (error) { otp.error = phoneError(error) }
  finally { otp.busy = false }
}

const confirmPhone = async () => {
  if (state.loading || otp.busy || otp.blocked || !otp.target || expired.value || !/^\d{6}$/.test(otp.code)) return
  otp.busy = true
  otp.error = ''
  try {
    await auth.confirmPhoneChange(otp.target, otp.code)
    phone.value = auth.customer?.phone || ''
    otp.target = ''
    otp.code = ''
    otp.done = true
  }
  catch (error) { otp.error = phoneError(error) }
  finally { otp.busy = false }
}

watch(() => auth.customer, (customer, previous) => {
  if (!customer) return
  for (const field of ['name', 'surname', 'email', 'birthday'] as const) {
    if (!previous || form[field] === (previous[field] || '')) form[field] = customer[field] || ''
  }
  if (!previous || phone.value === previous.phone) phone.value = customer.phone || ''
}, { immediate: true })

const hasChanges = computed(() => {
  const customer = auth.customer
  if (!customer) return false

  return (
    form.name !== (customer.name || '')
    || form.surname !== (customer.surname || '')
    || form.email !== (customer.email || '')
    || form.birthday !== (customer.birthday || '')
  )
})

const submit = async () => {
  if (state.loading || otp.busy || !hasChanges.value) return
  state.loading = true
  state.done = false
  state.error = ''
  try {
    await auth.updateProfile({ ...form })
    state.done = true
  }
  catch (error) {
    state.error = terms.value.cabinet.saveError
    console.error(error)
  }
  finally {
    state.loading = false
  }
}

useSeo(
  () => terms.value.cabinet.settings,
  () => terms.value.cabinet.settingsDescription,
)
</script>

<template>
  <CabinetShell>
    <form class="cabinet-settings" @submit.prevent="submit">
      <section class="cabinet-settings__row">
        <div class="cabinet-settings__copy">
          <h2>{{ terms.cabinet.personalData }}</h2>
          <p>{{ terms.cabinet.personalDataText }}</p>
        </div>
        <div class="cabinet-settings__fields cabinet-settings__fields--two">
          <BaseInput v-model="form.name" :label="terms.checkout.firstName" autocomplete="given-name" />
          <BaseInput v-model="form.surname" :label="terms.checkout.lastName" autocomplete="family-name" />
        </div>
      </section>

      <section class="cabinet-settings__row">
        <div class="cabinet-settings__copy">
          <h2>{{ terms.cabinet.contactInfo }}</h2>
          <p>{{ terms.cabinet.contactInfoText }}</p>
        </div>
        <div class="cabinet-settings__fields cabinet-settings__fields--two">
          <div class="cabinet-settings__fields">
          <BaseInput
            v-model="phone"
            type="tel"
            :label="terms.checkout.phone"
            autocomplete="tel"
            inputmode="tel"
            :disabled="state.loading || otp.busy"
          />
          <BaseButton size="sm" :disabled="!canSend" @click="sendPhoneCode">
            {{ retrySeconds ? terms.auth.resendIn(String(retrySeconds)) : otp.target ? terms.auth.resendCode : terms.auth.sendCode }}
          </BaseButton>
          <template v-if="otp.target">
            <p>{{ terms.auth.codeSentTo(otp.target) }}</p>
            <BaseInput v-model="otp.code" :label="terms.auth.otpCode" inputmode="numeric" autocomplete="one-time-code" :disabled="otp.busy || otp.blocked || expired" />
            <BaseButton size="sm" :disabled="state.loading || otp.busy || otp.blocked || expired || !/^\d{6}$/.test(otp.code)" @click="confirmPhone">{{ terms.auth.confirm }}</BaseButton>
            <p v-if="expired" class="cabinet-settings__error">{{ terms.auth.phoneCodeExpired }}</p>
          </template>
          <p v-if="otp.sendsLeft === 0" class="cabinet-settings__error">{{ terms.auth.phoneLimit }}</p>
          <p v-if="otp.error" role="alert" class="cabinet-settings__error">{{ otp.error }}</p>
          <p v-if="otp.done" role="status" class="cabinet-settings__success">{{ terms.cabinet.saved }}</p>
          </div>
          <BaseInput v-model="form.email" type="email" :label="terms.checkout.email" autocomplete="email" />
        </div>
      </section>

      <section class="cabinet-settings__row">
        <div class="cabinet-settings__copy">
          <h2>{{ terms.cabinet.birthDate }}</h2>
          <p>{{ terms.cabinet.birthDateText }}</p>
        </div>
        <BaseInput v-model="form.birthday" type="date" :label="terms.cabinet.birthDate" />
      </section>

      <div class="cabinet-settings__actions">
        <BaseButton type="submit" :disabled="!hasChanges || state.loading || otp.busy">
          {{ state.loading ? terms.checkout.processing : terms.cabinet.saveProfile }}
        </BaseButton>
        <p v-if="state.done" class="cabinet-settings__success">{{ terms.cabinet.saved }}</p>
        <p v-if="state.error" class="cabinet-settings__error">{{ state.error }}</p>
      </div>
    </form>
  </CabinetShell>
</template>

<style scoped>
.cabinet-settings {
  display: grid;
  gap: 1.5rem;
}

.cabinet-settings__row {
  display: grid;
  gap: 1rem;
  padding-bottom: 1.5rem;
}

.cabinet-settings :deep(.base-control),
.cabinet-settings :deep(.base-control:focus),
.cabinet-settings :deep(.base-control:focus-visible) {
  border: 0;
}

.cabinet-settings__copy {
  display: grid;
  gap: 0.45rem;
}

.cabinet-settings__copy h2 {
  font-size: 1.1rem;
  font-weight: 800;
}

.cabinet-settings__copy p {
  color: #737373;
  font-size: 0.85rem;
  line-height: 1.6;
}

.cabinet-settings__fields {
  display: grid;
  gap: 1rem;
}

.cabinet-settings__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.cabinet-settings__success {
  color: #047857;
  font-size: 0.9rem;
  font-weight: 700;
}

.cabinet-settings__error {
  color: #be123c;
  font-size: 0.9rem;
  font-weight: 700;
}

@media (min-width: 768px) {
  .cabinet-settings__fields--two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

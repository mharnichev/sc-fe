<script setup lang="ts">
import type { ShopAuthType } from './auth.types'

const props = withDefaults(defineProps<{
  phone: string
  debugCode?: string
}>(), {
  debugCode: '',
})

const auth = useCustomerAuthStore()
const { terms } = useShopLocale()

const otpCode = ref('')
const errorMessage = ref('')
const statusMessage = ref('')
const countdown = ref(120)
let timer: ReturnType<typeof setInterval> | undefined

const emit = defineEmits<{
  'change-type': [value: ShopAuthType]
  'hide-modal': []
  'otp-requested': [payload: { debugCode?: string }]
}>()

const formattedCountdown = computed(() => {
  const minutes = Math.floor(countdown.value / 60)
  const seconds = String(countdown.value % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
})

const resendAvailable = computed(() => countdown.value <= 0)

const startCountdown = () => {
  countdown.value = 120
  if (timer) clearInterval(timer)

  timer = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value -= 1
      return
    }

    if (timer) clearInterval(timer)
  }, 1000)
}

const verifyOtp = async () => {
  const code = otpCode.value.trim()
  if (!props.phone || code.length < 4 || auth.loading) return

  errorMessage.value = ''
  statusMessage.value = ''
  try {
    await auth.verifyOtp(props.phone, code)
    emit('hide-modal')
  }
  catch {
    errorMessage.value = auth.error || terms.value.auth.verifyError
  }
}

const resendOtp = async () => {
  if (!props.phone || !resendAvailable.value || auth.loading) return

  errorMessage.value = ''
  statusMessage.value = ''
  try {
    const response = await auth.requestOtp(props.phone)
    emit('otp-requested', { debugCode: response.debug_otp_code || '' })
    statusMessage.value = terms.value.auth.codeSent
    startCountdown()
  }
  catch {
    errorMessage.value = auth.error || terms.value.auth.sendCodeError
  }
}

watch(otpCode, value => {
  if (value.trim().length >= 6) verifyOtp()
})

onMounted(startCountdown)

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <section class="grid gap-6">
    <div class="grid gap-2 text-center">
      <div class="mx-auto flex h-20 w-20 items-center justify-center border border-neutral-950 bg-white text-3xl font-semibold text-neutral-950">
        SMS
      </div>
      <h3 class="text-lg font-semibold text-neutral-950">{{ terms.auth.confirmPhone }}</h3>
      <p class="text-sm leading-6 text-neutral-600">
        {{ terms.auth.codeSentTo(phone) }}
      </p>
    </div>

    <form class="grid gap-4" @submit.prevent="verifyOtp">
      <BaseInput
        v-model="otpCode"
        :label="terms.auth.otpCode"
        autocomplete="one-time-code"
        inputmode="numeric"
        required
        placeholder="000000"
        :disabled="auth.loading"
        :error="errorMessage"
      />

      <BaseButton type="submit" block :disabled="auth.loading || otpCode.trim().length < 4">
        {{ auth.loading ? terms.auth.checking : terms.auth.confirm }}
      </BaseButton>

      <BaseButton
        v-if="resendAvailable"
        type="button"
        variant="outline-dark"
        block
        :disabled="auth.loading"
        @click="resendOtp"
      >
        {{ terms.auth.resendCode }}
      </BaseButton>

      <p v-else class="text-center text-xs uppercase tracking-[0.18em] text-neutral-500">
        {{ terms.auth.resendIn(formattedCountdown) }}
      </p>

      <BaseButton
        type="button"
        class="mx-auto font-semibold"
        variant="text"
        :disabled="auth.loading"
        @click="emit('change-type', 'login')"
      >
        {{ terms.auth.changePhone }}
      </BaseButton>
    </form>

    <p v-if="statusMessage" class="text-sm text-emerald-700">{{ statusMessage }}</p>
    <p v-if="debugCode" class="text-xs text-neutral-500">{{ terms.auth.devCode(debugCode) }}</p>
  </section>
</template>

<script setup lang="ts">
import type { CustomerOtpRequestResponseDto } from '@shared-types'
import FeedbackFace from '~/components/ui/FeedbackFace.vue'
import type { ShopAuthType } from './auth.types'

const auth = useCustomerAuthStore()
const { terms } = useShopLocale()

const phone = ref(auth.customer?.phone || '')
const errorMessage = ref('')

const emit = defineEmits<{
  'change-type': [value: ShopAuthType]
  'otp-requested': [payload: { phone: string, response: CustomerOtpRequestResponseDto }]
}>()

watch(() => auth.customer?.phone, value => {
  if (value) phone.value = value
})

const requestOtp = async () => {
  const normalizedPhone = phone.value.trim()
  if (normalizedPhone.length < 7 || auth.loading) return

  errorMessage.value = ''
  try {
    const response = await auth.requestOtp(normalizedPhone)
    emit('otp-requested', { phone: normalizedPhone, response })
    emit('change-type', 'otp-code')
  }
  catch {
    errorMessage.value = auth.error || terms.value.auth.sendCodeError
  }
}
</script>

<template>
  <section class="grid gap-6">
    <div class="grid gap-3 text-center">
      <div class="mx-auto flex h-20 w-20 items-center justify-center text-neutral-950 [--feedback-face-cutout:#fff]">
        <FeedbackFace name="content-smile" class="w-14" />
      </div>
      <p class="text-sm leading-6 text-neutral-600">
        {{ terms.auth.intro }}
      </p>
    </div>

    <form class="grid gap-4" @submit.prevent="requestOtp">
      <BasePhoneInput
        v-model="phone"
        :label="terms.auth.phone"
        required
        :disabled="auth.loading"
        :error="errorMessage"
      />

      <BaseButton type="submit" block :disabled="auth.loading || phone.trim().length < 7">
        {{ auth.loading ? terms.auth.sending : terms.auth.sendCode }}
      </BaseButton>
    </form>
  </section>
</template>

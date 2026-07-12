<script setup lang="ts">
import type { Component } from 'vue'
import type { CustomerOtpRequestResponseDto } from '@shared-types'
import type { ShopAuthType } from '~/components/auth/auth.types'
import UserLogin from '~/components/auth/UserLogin.vue'
import UserOtpCode from '~/components/auth/UserOtpCode.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const auth = useCustomerAuthStore()
const modalStore = useModalStore()
const { terms } = useShopLocale()

const isShow = ref(false)
const userAuthType = ref<ShopAuthType>('login')
const otpPhone = ref('')
const debugCode = ref('')

const resetAuthFlow = () => {
  userAuthType.value = 'login'
  otpPhone.value = ''
  debugCode.value = ''
}

const hideAuthModal = () => {
  emit('update:modelValue', false)
  resetAuthFlow()
  modalStore.hideModal()
}

watch(() => props.modelValue, value => {
  isShow.value = value
}, { immediate: true })

const currentComponent = computed<Component>(() => {
  return userAuthType.value === 'otp-code' ? UserOtpCode : UserLogin
})

const currentTitle = computed(() => {
  if (auth.isAuthenticated) return terms.value.auth.account
  if (userAuthType.value === 'otp-code') return terms.value.auth.confirm
  return terms.value.common.signIn
})

const setType = (type: ShopAuthType = 'login') => {
  userAuthType.value = type
}

const setOtpRequest = (payload: { phone?: string, response?: CustomerOtpRequestResponseDto, debugCode?: string }) => {
  if (payload.phone) otpPhone.value = payload.phone
  debugCode.value = payload.response?.debug_otp_code || payload.debugCode || ''
}

const logout = () => {
  auth.logout()
  resetAuthFlow()
}
</script>

<template>
  <BaseModal
    v-model="isShow"
    full-height
    type="bottom"
    content-type="primary"
    root-class="shop-auth-sidebar"
    @close="hideAuthModal"
  >
    <template #header-title>{{ currentTitle }}</template>

    <div class="auth-sidebar" :class="{ 'auth-sidebar--center': !auth.isAuthenticated }">
      <div v-if="auth.isAuthenticated" class="auth-sidebar__account">
        <div>
          <p class="type-eyebrow text-xs text-neutral-500">{{ terms.common.profile }}</p>
          <h3 class="type-page-title mt-2 text-2xl text-neutral-950">{{ auth.displayName }}</h3>
          <p class="mt-1 text-sm text-neutral-500">{{ auth.customer?.phone }}</p>
        </div>

        <div class="grid gap-3 border-t border-neutral-950/10 pt-5">
          <BaseButton to="/cabinet/favorites" variant="outline-dark" block @click="hideAuthModal">
            {{ terms.common.favorites }}
          </BaseButton>
          <BaseButton to="/checkout/purchase" variant="outline-dark" block @click="hideAuthModal">
            {{ terms.common.checkout }}
          </BaseButton>
          <BaseButton type="button" block @click="logout">
            {{ terms.common.logOut }}
          </BaseButton>
        </div>
      </div>

      <Transition v-else name="auth-sidebar-page" mode="out-in" appear>
        <component
          :is="currentComponent"
          :key="userAuthType"
          :phone="otpPhone"
          :debug-code="debugCode"
          @change-type="setType"
          @otp-requested="setOtpRequest"
          @hide-modal="hideAuthModal"
        />
      </Transition>
    </div>
  </BaseModal>
</template>

<style scoped>
.auth-sidebar {
  height: 100%;
  padding: 1.25rem;
  background: #ffffff;
}

.auth-sidebar--center {
  display: grid;
  align-items: center;
}

.auth-sidebar__account {
  display: grid;
  min-height: 100%;
  align-content: space-between;
  gap: 2rem;
}

.auth-sidebar-page-enter-active,
.auth-sidebar-page-leave-active {
  transition: opacity 240ms ease, transform 240ms ease;
}

.auth-sidebar-page-enter-from,
.auth-sidebar-page-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>

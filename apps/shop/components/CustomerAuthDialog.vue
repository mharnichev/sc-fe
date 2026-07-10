<script setup lang="ts">
const auth = useCustomerAuthStore()
const modal = useModalStore()
const { terms } = useShopLocale()

withDefaults(defineProps<{
  label?: string
  authenticatedLabel?: string
  variant?: 'dark' | 'light' | 'outline-dark' | 'outline-light'
  size?: 'xs' | 'sm' | 'md'
  block?: boolean
}>(), {
  label: '',
  authenticatedLabel: '',
  variant: 'outline-dark',
  size: 'sm',
  block: false,
})

const openAuthSidebar = () => {
  modal.openModal('UserAuthModal')
}
</script>

<template>
  <BaseButton
    type="button"
    :variant="variant"
    :size="size"
    :block="block"
    @click="openAuthSidebar"
  >
    {{ auth.isAuthenticated ? (authenticatedLabel || auth.displayName) : (label || terms.common.signIn) }}
  </BaseButton>
</template>

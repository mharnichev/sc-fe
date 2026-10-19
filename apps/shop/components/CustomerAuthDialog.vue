<script setup lang="ts">
const auth = useCustomerAuthStore()
const modal = useModalStore()
const { terms } = useShopLocale()
const isHydrated = ref(false)

onMounted(() => {
  isHydrated.value = true
})

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
    {{ isHydrated && auth.isAuthenticated ? (authenticatedLabel || auth.displayName) : (label || terms.common.signIn) }}
  </BaseButton>
</template>

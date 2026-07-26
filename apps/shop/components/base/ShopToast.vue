<script setup lang="ts">
import { storeToRefs } from 'pinia'

const DISPLAY_DURATION_MS = 2600

const toast = useToastStore()
const modal = useModalStore()
const { terms } = useShopLocale()
const { isVisible, kind, productName, productImage, requestId } = storeToRefs(toast)

let dismissTimer: ReturnType<typeof setTimeout> | undefined

const content = computed(() => {
  if (kind.value === 'favorite-auth-required') {
    return {
      icon: '😔',
      title: terms.value.toast.favoriteAuthTitle,
      message: terms.value.toast.favoriteAuthMessage,
      action: terms.value.toast.signIn,
    }
  }

  if (kind.value === 'favorite-added') {
    return {
      icon: 'heart',
      title: terms.value.toast.favoriteAddedTitle,
      message: terms.value.toast.favoriteAddedMessage(productName.value),
      action: '',
    }
  }

  return {
    icon: 'shopping-cart',
    title: terms.value.toast.cartAddedTitle,
    message: terms.value.toast.cartAddedMessage(productName.value),
    action: '',
  }
})

const scheduleDismiss = () => {
  if (dismissTimer) clearTimeout(dismissTimer)
  dismissTimer = setTimeout(() => toast.dismiss(), DISPLAY_DURATION_MS)
}

const openLogin = () => {
  toast.dismiss()
  modal.openModal('UserAuthModal')
}

watch(requestId, scheduleDismiss)

onBeforeUnmount(() => {
  if (dismissTimer) clearTimeout(dismissTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="shop-toast">
      <aside
        v-if="isVisible"
        class="shop-toast"
        :class="`shop-toast--${kind}`"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span class="shop-toast__visual" aria-hidden="true">
          <img v-if="productImage" class="shop-toast__image" :src="productImage" alt="">
          <span v-else-if="kind === 'favorite-auth-required'" class="shop-toast__emoji">{{ content.icon }}</span>
          <BaseIcon v-else :name="content.icon" size="xs" />
          <span v-if="productImage && kind === 'favorite-auth-required'" class="shop-toast__emoji-badge">😔</span>
        </span>

        <span class="shop-toast__content">
          <strong>{{ content.title }}</strong>
          <span>{{ content.message }}</span>
        </span>

        <BaseButton
          v-if="content.action"
          class="shop-toast__action"
          type="button"
          variant="light"
          size="xs"
          shape="pill"
          @click="openLogin"
        >
          {{ content.action }}
        </BaseButton>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.shop-toast {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 1200;
  display: grid;
  width: min(24rem, calc(100vw - 3rem));
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid rgb(255 255 255 / 0.12);
  border-radius: 0.875rem;
  background: rgb(18 18 18 / 0.96);
  box-shadow: 0 1.25rem 3.5rem rgb(0 0 0 / 0.24);
  color: #fff;
  padding: 0.875rem 1rem;
  -webkit-backdrop-filter: blur(1rem);
  backdrop-filter: blur(1rem);
}

.shop-toast__visual {
  position: relative;
  display: inline-flex;
  width: 3rem;
  height: 3rem;
  flex: 0 0 3rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.625rem;
  background: #fff;
  color: #111;
}

.shop-toast--favorite-added .shop-toast__visual {
  background: #fff0f3;
  color: #d92952;
}

.shop-toast--favorite-auth-required .shop-toast__visual {
  background: #fff4d9;
}

.shop-toast__image {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: #fff;
  object-fit: contain;
}

.shop-toast__emoji {
  font-size: 1.2rem;
  line-height: 1;
}

.shop-toast__emoji-badge {
  position: absolute;
  right: -0.3rem;
  bottom: -0.3rem;
  display: inline-flex;
  width: 1.35rem;
  height: 1.35rem;
  align-items: center;
  justify-content: center;
  border: 2px solid rgb(27 27 29);
  border-radius: 50%;
  background: #fff4d9;
  font-size: 0.75rem;
  line-height: 1;
}

.shop-toast__content {
  display: grid;
  min-width: 0;
  gap: 0.125rem;
}

.shop-toast__content strong {
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1.25;
}

.shop-toast__content > span {
  overflow: hidden;
  color: rgb(255 255 255 / 0.7);
  font-size: 0.75rem;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-toast__action {
  --sc-button-border: transparent;
  --sc-button-shadow: none;
}

.shop-toast-enter-active,
.shop-toast-leave-active {
  transition: opacity 320ms ease, transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.shop-toast-enter-from,
.shop-toast-leave-to {
  opacity: 0;
  transform: translate3d(calc(100% + 2rem), 0, 0);
}

@media (max-width: 767px) {
  .shop-toast {
    top: max(0.75rem, env(safe-area-inset-top));
    right: 0.75rem;
    bottom: auto;
    left: 0.75rem;
    width: auto;
    border-radius: 1.25rem;
    background: rgb(27 27 29 / 0.94);
    box-shadow: 0 0.75rem 2.5rem rgb(0 0 0 / 0.22);
    padding: 0.75rem;
  }

  .shop-toast__content > span {
    white-space: normal;
  }

  .shop-toast-enter-from,
  .shop-toast-leave-to {
    transform: translate3d(0, calc(-100% - 2rem), 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .shop-toast-enter-active,
  .shop-toast-leave-active,
  .shop-toast__action {
    transition: none;
  }
}
</style>

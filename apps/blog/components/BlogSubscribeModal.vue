<script setup lang="ts">
import logoNameDark from '../../barbershop/assets/images/main/sc-logo-name-dark.webp'

const { initialEmail, isOpen } = useSubscribeModal()
const isModalVisible = ref(false)
const email = ref('')
const message = ref('')
const status = ref<'idle' | 'error' | 'success'>('idle')

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const resetMessage = () => {
  status.value = 'idle'
  message.value = ''
}

const closeModal = () => {
  isModalVisible.value = false
  isOpen.value = false
}

const handleSubscribe = () => {
  if (!isValidEmail(email.value)) {
    status.value = 'error'
    message.value = 'Enter a valid email address.'
    return
  }

  status.value = 'success'
  message.value = 'Thanks. This is a placeholder subscription for now.'
  email.value = ''
}

const handleDocumentClose = (event: MouseEvent | PointerEvent) => {
  const target = event.target

  if (!(target instanceof Element)) {
    return
  }

  if (target.closest('[data-subscribe-close]')) {
    event.preventDefault()
    closeModal()
  }
}

watch(isOpen, (nextIsOpen) => {
  isModalVisible.value = nextIsOpen

  if (!import.meta.client) {
    return
  }

  if (nextIsOpen) {
    email.value = initialEmail.value
    resetMessage()
  }
}, { immediate: true })

watch(isModalVisible, (nextIsVisible) => {
  if (import.meta.client) {
    document.documentElement.style.overflow = nextIsVisible ? 'hidden' : ''
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('click', handleDocumentClose, true)
    document.removeEventListener('pointerdown', handleDocumentClose, true)
    document.documentElement.style.overflow = ''
  }
})

onMounted(() => {
  document.addEventListener('click', handleDocumentClose, true)
  document.addEventListener('pointerdown', handleDocumentClose, true)
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isModalVisible"
      class="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black px-5 text-center text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscribe-modal-title"
    >
      <button
        type="button"
        class="absolute right-4 top-4 flex h-12 w-12 items-center justify-center text-white transition hover:text-white/60 sm:right-6 sm:top-6"
        aria-label="Close subscribe modal"
        data-subscribe-close
        @pointerdown.prevent.stop="closeModal"
        @click.prevent.stop="closeModal"
      >
        <span class="relative h-8 w-8" aria-hidden="true">
          <span class="absolute left-0 top-1/2 h-1 w-8 -translate-y-1/2 rotate-45 bg-current" />
          <span class="absolute left-0 top-1/2 h-1 w-8 -translate-y-1/2 -rotate-45 bg-current" />
        </span>
      </button>

      <div class="flex w-full max-w-xl flex-col items-center">
        <img :src="logoNameDark" alt="Soul Cuts" class="h-auto w-44 object-contain sm:w-56">
        <h2 id="subscribe-modal-title" class="sr-only">Subscribe</h2>

        <form id="subscribe-modal-form" class="mt-10 grid w-full gap-3 sm:grid-cols-[1fr_auto]" novalidate @submit.prevent="handleSubscribe">
          <label class="sr-only" for="subscribe-modal-email">Email address</label>
          <input
            id="subscribe-modal-email"
            v-model="email"
            class="min-h-12 w-full border border-white/20 bg-black px-4 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-white"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="Email address"
            aria-describedby="subscribe-modal-message"
            @input="resetMessage"
          >
          <button
            class="min-h-12 bg-white px-6 text-sm font-semibold uppercase tracking-[0.16em] text-neutral-950 transition hover:bg-white/85"
            type="submit"
          >
            Subscribe
          </button>
          <p
            id="subscribe-modal-message"
            class="min-h-6 text-sm sm:col-span-2"
            :class="status === 'error' ? 'text-white/70' : 'text-white/60'"
            aria-live="polite"
          >
            {{ message }}
          </p>
        </form>

        <p class="mt-7 max-w-lg text-xs leading-6 text-white/55">
          By subscribing, you agree Substack's
          <a class="underline decoration-white/25 underline-offset-4 transition hover:text-white" href="https://substack.com/tos" target="_blank" rel="noopener noreferrer">Terms of Use</a>,
          and acknowledge its
          <a class="underline decoration-white/25 underline-offset-4 transition hover:text-white" href="https://substack.com/privacy#information-collection-notice" target="_blank" rel="noopener noreferrer">Information Collection Notice</a>
          and
          <a class="underline decoration-white/25 underline-offset-4 transition hover:text-white" href="https://substack.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </p>

        <button
          type="button"
          class="mt-7 text-sm font-semibold uppercase tracking-[0.16em] text-white/55 transition hover:text-white"
          aria-label="No thanks, close subscribe modal"
          data-subscribe-close
          @pointerdown.prevent.stop="closeModal"
          @click.prevent.stop="closeModal"
        >
          No thanks
        </button>
      </div>
    </div>
  </Transition>
</template>

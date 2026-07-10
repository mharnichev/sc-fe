<script setup lang="ts">
import FeedbackFace from '~/components/ui/FeedbackFace.vue'
import logoNameDark from '../../barbershop/assets/images/main/sc-logo-name-dark.webp'

const { initialEmail, isOpen } = useSubscribeModal()
const { terms } = useBlogLocale()
const { subscribeToBlog } = useBlogSubscription()
const { trackBlogEvent } = useBlogAnalytics()
const isModalVisible = ref(false)
const email = ref('')
const message = ref('')
const status = ref<'idle' | 'error' | 'success'>('idle')
const isSubmitting = ref(false)

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const resetMessage = () => {
  status.value = 'idle'
  message.value = ''
}

const closeModal = () => {
  isModalVisible.value = false
  isOpen.value = false
}

const handleSubscribe = async () => {
  if (!isValidEmail(email.value)) {
    trackBlogEvent('subscribe_invalid', {
      source: 'modal',
    })
    status.value = 'error'
    message.value = terms.value.enterValidEmail
    return
  }

  trackBlogEvent('subscribe_submit', {
    source: 'modal',
  })
  isSubmitting.value = true
  resetMessage()

  try {
    await subscribeToBlog(email.value, 'blog_modal')
    trackBlogEvent('subscribe_success', {
      source: 'modal',
    })
    status.value = 'success'
    message.value = terms.value.subscriptionSuccess
    email.value = ''
  }
  catch {
    trackBlogEvent('subscribe_error', {
      source: 'modal',
    })
    status.value = 'error'
    message.value = terms.value.subscriptionError
  }
  finally {
    isSubmitting.value = false
  }
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
        :aria-label="terms.closeSubscribeModal"
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
        <img :src="logoNameDark" :alt="terms.soulCutsLogoAlt" class="h-auto w-44 object-contain sm:w-56">
        <h2 id="subscribe-modal-title" class="sr-only">{{ terms.subscribeModalTitle }}</h2>

        <form id="subscribe-modal-form" class="mt-10 grid w-full gap-3 sm:grid-cols-[1fr_auto]" novalidate @submit.prevent="handleSubscribe">
          <label class="sr-only" for="subscribe-modal-email">{{ terms.emailAddress }}</label>
          <input
            id="subscribe-modal-email"
            v-model="email"
            class="glass-control glass-control--dark min-h-12 w-full px-4 text-sm text-white outline-none placeholder:text-white/45"
            type="email"
            inputmode="email"
            autocomplete="email"
            :placeholder="terms.emailAddress"
            aria-describedby="subscribe-modal-message"
            @input="resetMessage"
          >
          <BaseButton
            variant="light"
            type="submit"
            :disabled="isSubmitting"
          >
            {{ terms.subscribe }}
          </BaseButton>
          <div
            id="subscribe-modal-message"
            class="flex min-h-6 items-center justify-center gap-2 text-sm sm:col-span-2"
            :class="status === 'error' ? 'text-white/70' : 'text-white/60'"
            aria-live="polite"
          >
            <FeedbackFace v-if="status === 'error'" name="sad-droopy-face" class="w-8 shrink-0" />
            <span>{{ message }}</span>
          </div>
        </form>

        <p class="mt-7 max-w-lg text-xs leading-6 text-white/55">
          {{ terms.subscribeAgreementPrefix }}
          <a class="underline decoration-white/25 underline-offset-4 transition hover:text-white" href="https://substack.com/tos" target="_blank" rel="noopener noreferrer">{{ terms.subscribeAgreementTerms }}</a>,
          {{ terms.subscribeAgreementMiddle }}
          <a class="underline decoration-white/25 underline-offset-4 transition hover:text-white" href="https://substack.com/privacy#information-collection-notice" target="_blank" rel="noopener noreferrer">{{ terms.subscribeAgreementCollectionNotice }}</a>
          {{ terms.subscribeAgreementAnd }}
          <a class="underline decoration-white/25 underline-offset-4 transition hover:text-white" href="https://substack.com/privacy" target="_blank" rel="noopener noreferrer">{{ terms.subscribeAgreementPrivacy }}</a>.
        </p>

        <button
          type="button"
          class="mt-7 text-sm font-semibold uppercase tracking-[0.16em] text-white/55 transition hover:text-white"
          :aria-label="terms.noThanksCloseSubscribeModal"
          data-subscribe-close
          @pointerdown.prevent.stop="closeModal"
          @click.prevent.stop="closeModal"
        >
          {{ terms.noThanks }}
        </button>
      </div>
    </div>
  </Transition>
</template>

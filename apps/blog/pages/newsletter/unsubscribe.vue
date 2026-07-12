<script setup lang="ts">
import FeedbackFace from '~/components/ui/FeedbackFace.vue'

const route = useRoute()
const { terms } = useBlogLocale()
const { unsubscribeFromBlog } = useBlogSubscription()

const token = computed(() => {
  const value = route.query.token

  return typeof value === 'string' ? value : ''
})
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const message = ref('')
const status = ref<'idle' | 'error' | 'success'>('idle')
const isSubmitting = ref(false)

const handleUnsubscribe = async () => {
  const trimmedEmail = email.value.trim()

  if (!token.value && !trimmedEmail) {
    status.value = 'error'
    message.value = terms.value.unsubscribeMissingIdentifier
    return
  }

  isSubmitting.value = true
  status.value = 'idle'
  message.value = ''

  try {
    await unsubscribeFromBlog({
      token: token.value || undefined,
      email: trimmedEmail || undefined,
      reason: 'user_request',
    })
    status.value = 'success'
    message.value = terms.value.unsubscribeSuccess
  }
  catch {
    status.value = 'error'
    message.value = terms.value.unsubscribeError
  }
  finally {
    isSubmitting.value = false
  }
}

useSeoMeta({
  title: () => terms.value.unsubscribeTitle,
  description: () => terms.value.unsubscribeDescription,
})
</script>

<template>
  <section class="flex min-h-[80vh] items-center bg-neutral-950 px-4 py-24 text-white sm:px-6">
    <div class="mx-auto w-full max-w-xl text-center">
      <p class="type-eyebrow text-xs text-white/45">
        {{ terms.newsletter }}
      </p>
      <h1 class="mt-5 text-3xl font-semibold uppercase leading-tight sm:text-4xl">
        {{ terms.unsubscribeTitle }}
      </h1>
      <p class="mx-auto mt-6 max-w-md text-sm leading-7 text-white/60">
        {{ terms.unsubscribeDescription }}
      </p>

      <form class="mt-10 grid gap-3 sm:grid-cols-[1fr_auto]" novalidate @submit.prevent="handleUnsubscribe">
        <label class="sr-only" for="unsubscribe-email">{{ terms.emailAddress }}</label>
        <input
          id="unsubscribe-email"
          v-model="email"
          class="glass-control glass-control--dark min-h-12 w-full px-4 text-sm text-white outline-none placeholder:text-neutral-500"
          type="email"
          inputmode="email"
          autocomplete="email"
          :placeholder="terms.emailPlaceholder"
          aria-describedby="unsubscribe-message"
        >
        <BaseButton
          variant="light"
          type="submit"
          :disabled="isSubmitting"
        >
          {{ terms.unsubscribeButton }}
        </BaseButton>
      </form>

      <div
        id="unsubscribe-message"
        class="mt-5 flex min-h-6 items-center justify-center gap-2 text-sm"
        :class="status === 'error' ? 'text-white/70' : 'text-white/60'"
        aria-live="polite"
      >
        <FeedbackFace v-if="status === 'error'" name="sad-droopy-face" class="w-8 shrink-0" />
        <span>{{ message }}</span>
      </div>

      <NuxtLink class="type-meta mt-8 inline-flex text-sm text-white/55 transition hover:text-white" to="/">
        {{ terms.home }}
      </NuxtLink>
    </div>
  </section>
</template>

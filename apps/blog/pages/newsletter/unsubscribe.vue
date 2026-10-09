<script setup lang="ts">
import FeedbackFace from '~/components/ui/FeedbackFace.vue'

const route = useRoute()
const { terms } = useBlogLocale()
const { unsubscribeFromBlog, subscribeToBlog, subscriptionError, unsubscribeToken } = useBlogSubscription()
const token = ref(unsubscribeToken)
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const message = ref('')
const status = ref<'idle' | 'error' | 'success'>('idle')
const isSubmitting = ref(false)
const unsubscribedEmail = ref('')

const handleUnsubscribe = async () => {
  if (isSubmitting.value) return
  const trimmedEmail = email.value.trim()

  if (!token.value.trim()) {
    status.value = 'error'
    message.value = terms.value.unsubscribeMissingIdentifier
    return
  }

  isSubmitting.value = true
  status.value = 'idle'
  message.value = ''

  try {
    const response = await unsubscribeFromBlog({
      token: token.value,
      email: trimmedEmail || undefined,
      reason: 'user_request',
    })
    status.value = 'success'
    unsubscribedEmail.value = response.email
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

const handleResubscribe = async () => {
  if (isSubmitting.value || !unsubscribedEmail.value || !token.value) return
  isSubmitting.value = true
  try {
    await subscribeToBlog(unsubscribedEmail.value, 'blog_resubscribe', token.value)
    status.value = 'success'
    message.value = terms.value.subscriptionSuccess
    unsubscribedEmail.value = ''
  }
  catch (error) {
    status.value = 'error'
    message.value = subscriptionError(error)
  }
  finally { isSubmitting.value = false }
}

useSeoMeta({
  title: () => terms.value.unsubscribeTitle,
  description: () => terms.value.unsubscribeDescription,
  robots: 'noindex,nofollow',
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
          :disabled="isSubmitting || !token.trim() || Boolean(unsubscribedEmail)"
        >
          {{ terms.unsubscribeButton }}
        </BaseButton>
      </form>
      <p v-if="!token.trim()" class="mt-5 text-sm" role="alert">{{ terms.unsubscribeMissingIdentifier }}</p>
      <BaseButton v-if="unsubscribedEmail" class="mt-5" variant="light" :disabled="isSubmitting" @click="handleResubscribe">{{ terms.resubscribeButton }}</BaseButton>

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

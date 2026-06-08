<script setup lang="ts">
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
      <p class="text-xs font-black uppercase tracking-[0.24em] text-white/45">
        {{ terms.newsletter }}
      </p>
      <h1 class="mt-5 text-4xl font-black uppercase leading-none sm:text-6xl">
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
          class="min-h-12 w-full border border-white/15 bg-neutral-900 px-4 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-white"
          type="email"
          inputmode="email"
          autocomplete="email"
          :placeholder="terms.emailPlaceholder"
          aria-describedby="unsubscribe-message"
        >
        <button
          class="min-h-12 bg-white px-6 text-sm font-semibold uppercase tracking-[0.16em] text-neutral-950 transition hover:bg-white/85"
          type="submit"
          :disabled="isSubmitting"
          :class="isSubmitting ? 'cursor-wait opacity-70' : ''"
        >
          {{ terms.unsubscribeButton }}
        </button>
      </form>

      <p
        id="unsubscribe-message"
        class="mt-5 min-h-6 text-sm"
        :class="status === 'error' ? 'text-white/70' : 'text-white/60'"
        aria-live="polite"
      >
        {{ message }}
      </p>

      <NuxtLink class="mt-8 inline-flex text-sm font-semibold uppercase tracking-[0.16em] text-white/55 transition hover:text-white" to="/">
        {{ terms.home }}
      </NuxtLink>
    </div>
  </section>
</template>

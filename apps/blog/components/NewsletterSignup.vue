<script setup lang="ts">
import FeedbackFace from '~/components/ui/FeedbackFace.vue'

const { terms } = useBlogLocale()
const { subscribeToBlog } = useBlogSubscription()
const { trackBlogEvent } = useBlogAnalytics()
const email = ref('')
const message = ref('')
const status = ref<'idle' | 'error' | 'success'>('idle')
const isSubmitting = ref(false)

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const handleSubmit = async () => {
  if (!isValidEmail(email.value)) {
    trackBlogEvent('subscribe_invalid', {
      source: 'newsletter_block',
    })
    status.value = 'error'
    message.value = terms.value.enterValidEmail
    return
  }

  trackBlogEvent('subscribe_submit', {
    source: 'newsletter_block',
  })
  isSubmitting.value = true
  status.value = 'idle'
  message.value = ''

  try {
    await subscribeToBlog(email.value, 'blog_newsletter')
    trackBlogEvent('subscribe_success', {
      source: 'newsletter_block',
    })
    status.value = 'success'
    message.value = terms.value.subscriptionSuccess
    email.value = ''
  }
  catch {
    trackBlogEvent('subscribe_error', {
      source: 'newsletter_block',
    })
    status.value = 'error'
    message.value = terms.value.subscriptionError
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section id="newsletter" class="border-y border-neutral-800 bg-neutral-950 py-12 text-white sm:py-16">
    <div class="site-container">
      <div class="grid gap-8 lg:grid-cols-[0.8fr_1fr] lg:items-end">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">{{ terms.newsletter }}</p>
          <h2 class="blog-section-title mt-3 text-white">
            {{ terms.newsletterHeadline }}
          </h2>
          <p class="mt-4 max-w-xl text-sm leading-7 text-white/65">
            {{ terms.newsletterDescription }}
          </p>
        </div>

        <form class="grid gap-3 sm:grid-cols-[1fr_auto]" novalidate @submit.prevent="handleSubmit">
          <label class="sr-only" for="newsletter-email">{{ terms.emailAddress }}</label>
          <input
            id="newsletter-email"
            v-model="email"
            class="glass-control glass-control--dark min-h-12 w-full px-4 text-sm text-white outline-none placeholder:text-neutral-500"
            type="email"
            inputmode="email"
            autocomplete="email"
            :placeholder="terms.emailPlaceholder"
            aria-describedby="newsletter-message"
          >
          <BaseButton
            variant="light"
            type="submit"
            :disabled="isSubmitting"
          >
            {{ terms.subscribe }}
          </BaseButton>
          <div
            id="newsletter-message"
            class="flex min-h-6 items-center gap-2 text-sm sm:col-span-2"
            :class="status === 'error' ? 'text-white/70' : 'text-white/65'"
            aria-live="polite"
          >
            <FeedbackFace v-if="status === 'error'" name="sad-droopy-face" class="w-7 shrink-0" />
            <span>{{ message }}</span>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

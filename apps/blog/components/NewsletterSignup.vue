<script setup lang="ts">
const email = ref('')
const message = ref('')
const status = ref<'idle' | 'error' | 'success'>('idle')

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const handleSubmit = () => {
  if (!isValidEmail(email.value)) {
    status.value = 'error'
    message.value = 'Enter a valid email address.'
    return
  }

  status.value = 'success'
  message.value = 'Thanks. This is a placeholder subscription for now.'
  email.value = ''
}
</script>

<template>
  <section id="newsletter" class="border-y border-neutral-800 bg-neutral-950 py-12 text-white sm:py-16">
    <div class="site-container">
      <div class="grid gap-8 lg:grid-cols-[0.8fr_1fr] lg:items-end">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-red-400">Newsletter</p>
          <h2 class="mt-3 text-3xl font-black leading-tight sm:text-4xl">
            Get the next story in your inbox.
          </h2>
          <p class="mt-4 max-w-xl text-sm leading-7 text-white/65">
            A simple subscription block for the first version. Provider integration can be added later.
          </p>
        </div>

        <form class="grid gap-3 sm:grid-cols-[1fr_auto]" novalidate @submit.prevent="handleSubmit">
          <label class="sr-only" for="newsletter-email">Email address</label>
          <input
            id="newsletter-email"
            v-model="email"
            class="min-h-12 w-full border border-white/15 bg-neutral-900 px-4 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-red-400"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="you@example.com"
            aria-describedby="newsletter-message"
          >
          <button
            class="min-h-12 border border-red-500 bg-red-500 px-6 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:border-red-600 hover:bg-red-600"
            type="submit"
          >
            Subscribe
          </button>
          <p
            id="newsletter-message"
            class="sm:col-span-2 text-sm"
            :class="status === 'error' ? 'text-red-300' : 'text-white/65'"
            aria-live="polite"
          >
            {{ message }}
          </p>
        </form>
      </div>
    </div>
  </section>
</template>

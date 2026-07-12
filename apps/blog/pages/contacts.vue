<script setup lang="ts">
const { terms } = useBlogLocale()
const { sendFeedback } = useBlogFeedback()
const { trackBlogEvent } = useBlogAnalytics()

const MAP_URL = 'https://maps.app.goo.gl/h9AqbjAoWUksTRw96'
const FIELD_LIMITS = {
  name: 120,
  email: 254,
  message: 1000,
} as const
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const form = reactive({
  name: '',
  phone: '',
  email: '',
  message: '',
})
const state = reactive({
  loading: false,
  success: '',
  error: '',
})

const contact = computed(() => terms.value.contacts)
const phoneHref = computed(() => `tel:${contact.value.phone.replace(/[^\d+]/g, '')}`)
const emailHref = computed(() => `mailto:${contact.value.email}`)

const constrainInput = (value: string, maxLength: number, multiline = false) => {
  const normalized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
  const formatted = multiline
    ? normalized.replace(/\r\n?/g, '\n')
    : normalized.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ')

  return formatted.slice(0, maxLength)
}

const normalizePhoneDigits = (value: string) => {
  let digits = value.replace(/\D/g, '')

  if (!digits) return ''
  if (digits.startsWith('380')) return digits.slice(0, 12)
  if (digits.startsWith('0')) return `38${digits}`.slice(0, 12)
  if (digits.startsWith('80')) return `3${digits}`.slice(0, 12)

  return `380${digits}`.slice(0, 12)
}

const formatPhoneInput = (value: string) => {
  const digits = normalizePhoneDigits(value)

  if (!digits) return ''
  if (digits.length <= 3) return `+${digits}`

  return [
    '+380',
    digits.slice(3, 5),
    digits.slice(5, 8),
    digits.slice(8, 10),
    digits.slice(10, 12),
  ].filter(Boolean).join(' ')
}

const isValidPhone = (value: string) => /^380[1-9]\d{8}$/.test(normalizePhoneDigits(value))

const handlePhoneInput = (event: Event) => {
  form.phone = formatPhoneInput((event.target as HTMLInputElement).value)
}

const handleTextInput = (field: 'name' | 'email' | 'message', maxLength: number, multiline = false) => {
  form[field] = constrainInput(form[field], maxLength, multiline)
}

const resetForm = () => {
  form.name = ''
  form.phone = ''
  form.email = ''
  form.message = ''
}

const submit = async () => {
  state.success = ''
  state.error = ''

  const name = constrainInput(form.name, FIELD_LIMITS.name).trim()
  const email = constrainInput(form.email, FIELD_LIMITS.email).trim()
  const message = constrainInput(form.message, FIELD_LIMITS.message, true).trim()

  if (name.length < 2 || message.length < 3 || !EMAIL_PATTERN.test(email)) {
    state.error = contact.value.requiredMessage
    return
  }

  if (form.phone.trim() && !isValidPhone(form.phone)) {
    state.error = contact.value.phoneInvalid
    return
  }

  state.loading = true
  trackBlogEvent('contact_submit', { source: 'contacts_page' })

  try {
    const text = form.phone.trim()
      ? `Phone: ${form.phone.trim()}\n\n${message}`
      : message

    await sendFeedback({ name, email, text })
    state.success = contact.value.successMessage
    trackBlogEvent('contact_success', { source: 'contacts_page' })
    resetForm()
  }
  catch (error) {
    state.error = contact.value.errorMessage
    trackBlogEvent('contact_error', { source: 'contacts_page' })
    console.error(error)
  }
  finally {
    state.loading = false
  }
}

const trackContactClick = (type: string) => {
  trackBlogEvent('contact_click', {
    link_type: type,
    source: 'contacts_page',
  })
}

useSeoMeta({
  title: () => contact.value.seoTitle,
  description: () => contact.value.seoDescription,
})
</script>

<template>
  <div>
    <section data-header-theme="dark" class="flex min-h-screen items-center bg-neutral-950 pb-12 pt-28 sm:pb-16 sm:pt-32 lg:pb-20">
      <div class="site-container">
        <p class="eyebrow">{{ contact.eyebrow }}</p>
        <h1 class="blog-display-title mt-4 max-w-5xl text-white">
          {{ contact.title }}
        </h1>
        <p class="blog-body-copy mt-6 max-w-2xl text-white/60">
          {{ contact.description }}
        </p>

        <div class="mt-10 border-t border-white/15 pt-8 sm:mt-14 sm:pt-10">
          <h2 class="blog-section-title text-white">{{ contact.detailsTitle }}</h2>
          <div class="mt-7 grid gap-px bg-white/15 sm:grid-cols-2 lg:grid-cols-4">
            <div class="bg-neutral-950 p-5 sm:p-6">
              <p class="type-eyebrow text-xs text-white/40">{{ contact.addressLabel }}</p>
              <p class="mt-3 text-base leading-7 text-white">{{ contact.address }}</p>
              <a
                :href="MAP_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-4 inline-block text-sm font-semibold uppercase text-white/60 underline decoration-white/20 underline-offset-4 transition hover:text-white hover:decoration-white"
                @click="trackContactClick('map')"
              >
                {{ contact.mapLabel }}
              </a>
            </div>

            <div class="bg-neutral-950 p-5 sm:p-6">
              <p class="type-eyebrow text-xs text-white/40">{{ contact.phoneLabel }}</p>
              <a :href="phoneHref" class="mt-3 block text-base font-semibold text-white transition hover:text-lime-300" @click="trackContactClick('phone')">
                {{ contact.phone }}
              </a>
            </div>

            <div class="bg-neutral-950 p-5 sm:p-6">
              <p class="type-eyebrow text-xs text-white/40">{{ contact.emailLabel }}</p>
              <a :href="emailHref" class="mt-3 block break-all text-sm font-semibold text-white transition hover:text-lime-300" @click="trackContactClick('email')">
                {{ contact.email }}
              </a>
            </div>

            <div class="bg-neutral-950 p-5 sm:p-6">
              <p class="type-eyebrow text-xs text-white/40">{{ contact.hoursLabel }}</p>
              <dl class="mt-3 space-y-2 text-sm leading-6 text-white/75">
                <div v-for="[day, time] in contact.hours" :key="day" class="flex justify-between gap-4">
                  <dt>{{ day }}</dt>
                  <dd class="text-right text-white">{{ time }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section data-header-theme="light" class="bg-stone-100 py-12 text-neutral-950 sm:py-16 lg:py-20">
      <div class="site-container">
        <div class="max-w-3xl">
          <p class="type-eyebrow text-xs text-neutral-500">{{ contact.formEyebrow }}</p>
          <h2 class="blog-section-title mt-4">{{ contact.formTitle }}</h2>
          <p class="blog-body-copy mt-5 max-w-2xl text-neutral-600">{{ contact.formDescription }}</p>
        </div>

        <form class="mt-10 bg-white p-4 sm:p-8" @submit.prevent="submit">
          <div class="grid gap-5 md:grid-cols-2">
            <label class="block">
              <span class="type-eyebrow text-xs text-neutral-500">{{ contact.fields.name }}</span>
              <input
                v-model="form.name"
                required
                autocomplete="name"
                minlength="2"
                :maxlength="FIELD_LIMITS.name"
                :placeholder="contact.placeholders.name"
                class="glass-control glass-control--light mt-2 w-full border border-neutral-200 px-4 py-3 text-neutral-950 outline-none placeholder:text-neutral-400"
                @input="handleTextInput('name', FIELD_LIMITS.name)"
              >
            </label>

            <label class="block">
              <span class="type-eyebrow text-xs text-neutral-500">{{ contact.fields.phone }}</span>
              <input
                v-model="form.phone"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                maxlength="17"
                pattern="\+380\s\d{2}\s\d{3}\s\d{2}\s\d{2}"
                :placeholder="contact.placeholders.phone"
                class="glass-control glass-control--light mt-2 w-full border border-neutral-200 px-4 py-3 text-neutral-950 outline-none placeholder:text-neutral-400"
                @input="handlePhoneInput"
              >
            </label>

            <label class="block md:col-span-2">
              <span class="type-eyebrow text-xs text-neutral-500">{{ contact.fields.email }}</span>
              <input
                v-model="form.email"
                required
                type="email"
                autocomplete="email"
                :maxlength="FIELD_LIMITS.email"
                :placeholder="contact.placeholders.email"
                class="glass-control glass-control--light mt-2 w-full border border-neutral-200 px-4 py-3 text-neutral-950 outline-none placeholder:text-neutral-400"
                @input="handleTextInput('email', FIELD_LIMITS.email)"
              >
            </label>

            <label class="block md:col-span-2">
              <span class="type-eyebrow text-xs text-neutral-500">{{ contact.fields.message }}</span>
              <textarea
                v-model="form.message"
                required
                rows="6"
                minlength="3"
                :maxlength="FIELD_LIMITS.message"
                :placeholder="contact.placeholders.message"
                class="glass-control glass-control--light mt-2 w-full resize-none border border-neutral-200 px-4 py-3 text-neutral-950 outline-none placeholder:text-neutral-400"
                @input="handleTextInput('message', FIELD_LIMITS.message, true)"
              />
            </label>
          </div>

          <div class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <BaseButton type="submit" :disabled="state.loading">
              {{ state.loading ? contact.sending : contact.submit }}
            </BaseButton>
            <p class="text-sm leading-6 text-neutral-500">{{ contact.note }}</p>
          </div>

          <p v-if="state.success" role="status" class="mt-5 border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {{ state.success }}
          </p>
          <p v-if="state.error" role="alert" class="mt-5 border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {{ state.error }}
          </p>
        </form>
      </div>
    </section>
  </div>
</template>

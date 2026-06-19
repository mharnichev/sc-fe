<script setup lang="ts">
const { terms } = useTerms()
const { trackEvent } = useAnalytics()

const form = reactive({
  name: '',
  phone: '',
  email: '',
  message: '',
})

const state = reactive({
  success: '',
  error: '',
})

const contactEmail = computed(() => terms.value.home.feedback.recipientEmail.trim())

const resetForm = () => {
  form.name = ''
  form.phone = ''
  form.email = ''
  form.message = ''
}

const closeSuccess = () => {
  state.success = ''
}

const handlePhoneInput = (event: Event) => {
  form.phone = formatPhoneInput((event.target as HTMLInputElement).value)
}

const handlePhonePasteEvent = (event: ClipboardEvent) => {
  handlePhonePaste(event, value => {
    form.phone = value
  })
}

const handleTextInput = (
  field: 'name' | 'email' | 'message',
  maxLength: number,
  options: { multiline?: boolean } = {},
) => {
  form[field] = constrainFormInput(form[field], maxLength, options)
}

const submit = () => {
  state.success = ''
  state.error = ''

  const safeName = sanitizeFormText(form.name, FORM_FIELD_LIMITS.name)
  const safeEmail = sanitizeFormText(form.email, FORM_FIELD_LIMITS.email)
  const safeMessage = sanitizeFormText(form.message, FORM_FIELD_LIMITS.message, { multiline: true })

  if (!safeName || !safeMessage) {
    state.error = terms.value.home.feedback.requiredMessage
    return
  }

  if (form.phone.trim() && !isValidPhoneNumber(form.phone)) {
    state.error = terms.value.home.feedback.phoneInvalid
    return
  }

  if (!contactEmail.value) {
    state.success = terms.value.home.feedback.fallbackMessage
    trackEvent('generate_lead', {
      source: 'feedback_form',
      method: 'fallback',
    })
    resetForm()
    return
  }

  const body = [
    `${terms.value.home.feedback.fields.name}: ${safeName}`,
    `${terms.value.home.feedback.fields.phone}: ${form.phone.trim() || '-'}`,
    `${terms.value.home.feedback.fields.email}: ${safeEmail || '-'}`,
    '',
    safeMessage,
  ].join('\n')

  const mailto = new URL(`mailto:${contactEmail.value}`)
  mailto.searchParams.set('subject', terms.value.home.feedback.mailSubject)
  mailto.searchParams.set('body', body)

  window.location.href = mailto.toString()
  state.success = terms.value.home.feedback.successMessage
  trackEvent('generate_lead', {
    source: 'feedback_form',
    method: 'mailto',
  })
  resetForm()
}
</script>

<template>
  <section id="feedback" data-header-theme="light" class="section-y-tight bg-stone-100">
    <div class="site-container grid gap-8 pt-10 md:gap-12 md:pt-24 lg:grid-cols-[0.35fr_0.65fr]">
      <div data-reveal="soft">
        <SectionLabel>{{ terms.home.feedback.label }}</SectionLabel>
        <h2 class="section-title mt-4 md:text-5xl">{{ terms.home.feedback.title }}</h2>
        <p class="mt-5 max-w-md text-base leading-7 text-neutral-600 md:leading-8">
          {{ terms.home.feedback.description }}
        </p>
      </div>

      <form class="relative overflow-hidden border border-neutral-300 bg-white p-4 md:p-8" data-reveal="soft" data-reveal-delay="140" @submit.prevent="submit">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">{{ terms.home.feedback.fields.name }}</span>
            <input
              v-model="form.name"
              required
              autocomplete="name"
              minlength="2"
              :maxlength="FORM_FIELD_LIMITS.name"
              :placeholder="terms.home.feedback.placeholders.name"
              class="mt-2 w-full border border-neutral-300 bg-transparent px-4 py-3 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950"
              @input="handleTextInput('name', FORM_FIELD_LIMITS.name)"
            >
          </label>

          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">{{ terms.home.feedback.fields.phone }}</span>
            <input
              v-model="form.phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              maxlength="17"
              pattern="\+380\s\d{2}\s\d{3}\s\d{2}\s\d{2}"
              :placeholder="terms.home.feedback.placeholders.phone"
              :aria-invalid="Boolean(form.phone && !isValidPhoneNumber(form.phone))"
              class="mt-2 w-full border border-neutral-300 bg-transparent px-4 py-3 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950"
              @input="handlePhoneInput"
              @paste="handlePhonePasteEvent"
            >
          </label>

          <label class="block md:col-span-2">
            <span class="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">{{ terms.home.feedback.fields.email }}</span>
            <input
              v-model="form.email"
              type="email"
              autocomplete="email"
              :maxlength="FORM_FIELD_LIMITS.email"
              :placeholder="terms.home.feedback.placeholders.email"
              class="mt-2 w-full border border-neutral-300 bg-transparent px-4 py-3 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950"
              @input="handleTextInput('email', FORM_FIELD_LIMITS.email)"
            >
          </label>

          <label class="block md:col-span-2">
            <span class="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">{{ terms.home.feedback.fields.message }}</span>
            <textarea
              v-model="form.message"
              required
              rows="5"
              minlength="3"
              :maxlength="FORM_FIELD_LIMITS.message"
              :placeholder="terms.home.feedback.placeholders.message"
              class="mt-2 w-full resize-none border border-neutral-300 bg-transparent px-4 py-3 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950"
              @input="handleTextInput('message', FORM_FIELD_LIMITS.message, { multiline: true })"
            />
          </label>
        </div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            class="inline-flex items-center justify-center bg-neutral-950 px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-neutral-800"
          >
            {{ terms.home.feedback.submit }}
          </button>
          <p class="text-sm leading-6 text-neutral-500">
            {{ terms.home.feedback.note }}
          </p>
        </div>

        <p v-if="state.error" class="mt-4 text-sm leading-6 text-rose-700">{{ state.error }}</p>
        <FormStatusOverlay
          :show="Boolean(state.success)"
          :label="terms.home.feedback.successLabel"
          :title="terms.home.feedback.successTitle"
          :message="state.success"
          :action-label="terms.home.feedback.successAction"
          @action="closeSuccess"
        />
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
const domain = useCatalogDomain()
const { terms } = useShopLocale()

const form = reactive({ name: '', email: '', text: '' })
const state = reactive({ loading: false, done: false, error: '' })

const contacts = computed(() => [
  { icon: 'pin', label: terms.value.footer.location, href: 'https://maps.app.goo.gl/h9AqbjAoWUksTRw96', external: true },
  { icon: 'phone', label: '+380 63 699 57 30', href: 'tel:+380636995730' },
  { icon: 'email', label: 'Soulcutsplace@gmail.com', href: 'mailto:Soulcutsplace@gmail.com' },
  { icon: 'clock', label: terms.value.contacts.schedule, href: '' },
])

const submit = async () => {
  state.loading = true
  state.done = false
  state.error = ''
  try {
    await domain.sendFeedback(form)
    form.name = ''
    form.email = ''
    form.text = ''
    state.done = true
  }
  catch (error) {
    state.error = terms.value.contacts.feedbackError
    console.error(error)
  }
  finally {
    state.loading = false
  }
}

useSeo(
  () => terms.value.contacts.title,
  () => terms.value.contacts.subtitle,
)
</script>

<template>
  <section class="contact-page">
    <h1 class="contact-page__title">{{ terms.contacts.title }}</h1>
    <p class="contact-page__subtitle">{{ terms.contacts.subtitle }}</p>

    <div class="contact-page__grid">
      <article class="contact-page__box">
        <div class="contact-page__copy">
          <h2>{{ terms.contacts.ourContacts }}</h2>
          <p>{{ terms.contacts.ourContactsText }}</p>
        </div>
        <div class="contact-page__list">
          <component
            :is="item.href ? 'a' : 'div'"
            v-for="item in contacts"
            :key="item.label"
            class="contact-page__row"
            :href="item.href || undefined"
            :target="item.external ? '_blank' : undefined"
            :rel="item.external ? 'noopener noreferrer' : undefined"
          >
            <BaseIcon :name="item.icon" size="xxs" />
            <span>{{ item.label }}</span>
          </component>
        </div>
      </article>

      <form class="contact-page__box" @submit.prevent="submit">
        <div class="contact-page__copy">
          <h2>{{ terms.contacts.feedbackTitle }}</h2>
          <p>{{ terms.contacts.feedbackText }}</p>
        </div>
        <BaseInput v-model="form.name" :label="terms.checkout.firstName" required autocomplete="name" />
        <BaseInput v-model="form.email" type="email" :label="terms.checkout.email" required autocomplete="email" />
        <BaseTextarea v-model="form.text" :label="terms.contacts.message" required :rows="5" />
        <BaseButton type="submit" :disabled="state.loading">
          {{ state.loading ? terms.checkout.processing : terms.contacts.send }}
        </BaseButton>
        <p v-if="state.done" class="contact-page__success">{{ terms.contacts.feedbackSuccess }}</p>
        <p v-if="state.error" class="contact-page__error">{{ state.error }}</p>
      </form>
    </div>

    <div class="contact-page__map">
      <iframe
        title="Soul Cuts map"
        src="https://www.google.com/maps?q=%D0%9A%D0%B0%D0%BD%D0%B0%D1%82%D0%BD%D0%B0%206%2C%20%D0%9E%D0%B4%D0%B5%D1%81%D0%B0&output=embed"
        allowfullscreen
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      />
    </div>
  </section>
</template>

<style scoped>
.contact-page {
  display: grid;
  gap: 1.5rem;
}

.contact-page__title {
  text-align: center;
  color: #343434;
  font-size: 2rem;
  font-weight: 800;
}

.contact-page__subtitle {
  margin: 0 auto;
  max-width: 42rem;
  text-align: center;
  color: #525252;
  line-height: 1.7;
}

.contact-page__grid {
  display: grid;
  gap: 1.5rem;
}

.contact-page__box {
  display: grid;
  align-content: start;
  gap: 1rem;
  background: #ffffff;
  padding: 1.5rem;
}

.contact-page__copy {
  display: grid;
  gap: 0.5rem;
}

.contact-page__copy h2 {
  font-size: 1.15rem;
  font-weight: 800;
}

.contact-page__copy p {
  color: #737373;
  line-height: 1.7;
}

.contact-page__list {
  display: grid;
  gap: 0.75rem;
}

.contact-page__row {
  display: flex;
  gap: 0.85rem;
  align-items: center;
  background: #f3f4f7;
  padding: 0.85rem 1rem;
  color: #343434;
}

.contact-page__success {
  color: #047857;
  font-weight: 700;
}

.contact-page__error {
  color: #be123c;
  font-weight: 700;
}

.contact-page__map {
  overflow: hidden;
  background: #ffffff;
}

.contact-page__map iframe {
  display: block;
  width: 100%;
  min-height: 26rem;
  border: 0;
}

@media (min-width: 900px) {
  .contact-page__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

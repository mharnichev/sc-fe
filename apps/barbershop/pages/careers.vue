<script setup lang="ts">
const { terms } = useTerms()
const copy = computed(() => terms.value.home.recruitment)
const contact = computed(() => terms.value.home.contact)
const emailHref = computed(() => `mailto:${contact.value.email}?subject=${encodeURIComponent(copy.value.emailSubject)}`)
const phoneHref = computed(() => `tel:${contact.value.phone.replace(/[^\d+]/g, '')}`)

useSeo(
  () => copy.value.pageTitle,
  () => copy.value.pageDescription,
  { image: '/videos/soulcuts-recruitment-poster.webp' },
)
</script>

<template>
  <div class="bg-neutral-950 text-white">
    <RecruitmentSection standalone />

    <div data-header-theme="dark" class="site-container py-12 md:py-20">
      <div class="grid gap-10 md:grid-cols-2 md:gap-16">
        <section aria-labelledby="careers-about">
          <h2 id="careers-about" class="section-title text-2xl font-semibold md:text-3xl">{{ copy.aboutTitle }}</h2>
          <p class="mt-4 max-w-prose leading-7 text-neutral-300">{{ copy.aboutText }}</p>
          <p class="mt-4 text-sm font-medium text-neutral-300">{{ contact.address }}</p>
        </section>

        <section aria-labelledby="careers-contact">
          <h2 id="careers-contact" class="section-title text-2xl font-semibold md:text-3xl">{{ copy.contactTitle }}</h2>
          <p class="mt-4 max-w-prose leading-7 text-neutral-300">{{ copy.contactText }}</p>
          <div class="mt-5 flex flex-wrap gap-x-6 gap-y-3 font-semibold">
            <a :href="emailHref" class="underline underline-offset-4">{{ contact.email }}</a>
            <a :href="phoneHref" class="underline underline-offset-4">{{ contact.phone }}</a>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

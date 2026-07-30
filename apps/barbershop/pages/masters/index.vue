<script setup lang="ts">
const { locale, terms } = useTerms()
const domain = useBarbershopDomain()
const { masterFullName } = useMasterDisplay()
const { reviewToken, clearPrivateReview } = useReviewPrivacy()
const { data: masters } = await useAsyncData(
  'masters-index-public-profiles',
  domain.getMasters,
  { default: () => [] },
)
const profileLinks = computed(() =>
  indexablePublicMasters(masters.value).map(master => ({
    id: master.id,
    name: masterFullName(master),
    path: masterSeoPath(master),
  })),
)
const pageCopy = computed(() => locale.value === 'en'
  ? {
      intro: 'Public Soul Cuts barber profiles with their current services, prices, appointment duration and approved client reviews when available.',
      journal: 'Soul Cuts Journal',
      local: 'Barbershop in Odesa',
      profiles: 'Barber profiles',
      services: 'View services',
    }
  : {
      intro: 'Публічні профілі майстрів Soul Cuts з актуальними послугами, цінами, тривалістю запису та схваленими відгуками клієнтів, якщо вони доступні.',
      journal: 'Журнал Soul Cuts',
      local: 'Барбершоп в Одесі',
      profiles: 'Профілі майстрів',
      services: 'Переглянути послуги',
    })

useSeo(
  () => terms.value.seo.mastersTitle,
  () => pageCopy.value.intro,
)

const clearReviewToken = () => {
  clearPrivateReview()
}

onBeforeUnmount(clearReviewToken)
</script>

<template>
  <div>
    <section class="section-y pb-10">
      <div class="site-container grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(18rem,0.4fr)] lg:items-end">
        <div data-reveal="soft">
          <SectionLabel>{{ terms.pages.masters.label }}</SectionLabel>
          <h1 class="type-page-title mt-4 text-4xl text-stone-950 md:text-6xl">
            {{ terms.pages.masters.title }}
          </h1>
          <p class="mt-5 max-w-3xl text-base leading-8 text-stone-700 md:text-lg">
            {{ pageCopy.intro }}
          </p>
          <nav
            v-if="profileLinks.length"
            class="mt-7 flex flex-wrap gap-x-5 gap-y-3"
            :aria-label="pageCopy.profiles"
          >
            <NuxtLink
              v-for="profile in profileLinks"
              :key="profile.id"
              :to="profile.path"
              class="text-sm font-semibold text-stone-700 transition hover:text-stone-950"
            >
              <BaseHoverUnderlineText>{{ profile.name }}</BaseHoverUnderlineText>
            </NuxtLink>
          </nav>
        </div>
        <nav class="flex flex-col items-start gap-3 text-sm font-semibold text-stone-700" :aria-label="terms.pages.masters.title">
          <NuxtLink to="/services" class="transition hover:text-stone-950">
            <BaseHoverUnderlineText>{{ pageCopy.services }}</BaseHoverUnderlineText>
          </NuxtLink>
          <NuxtLink to="/barbershop-odesa" class="transition hover:text-stone-950">
            <BaseHoverUnderlineText>{{ pageCopy.local }}</BaseHoverUnderlineText>
          </NuxtLink>
          <a href="/blog/" class="transition hover:text-stone-950">
            <BaseHoverUnderlineText>{{ pageCopy.journal }}</BaseHoverUnderlineText>
          </a>
        </nav>
      </div>
    </section>
    <TeamSection booking-target="/#booking" />
    <ClientOnly>
      <LazyReviewRequestModal
        v-if="reviewToken"
        :token="reviewToken"
        @closed="clearReviewToken"
      />
    </ClientOnly>
  </div>
</template>

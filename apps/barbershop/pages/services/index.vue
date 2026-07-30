<script setup lang="ts">
const { locale, terms } = useTerms()
const domain = useBarbershopDomain()
const localizedService = useLocalizedService()
const { data: services } = await useAsyncData('service-catalog', domain.getServiceCatalog)
const activeServices = computed(() => indexableServiceCatalog(services.value))
const pageIntro = computed(() => locale.value === 'en'
  ? 'Current services, prices and appointment duration from the public Soul Cuts catalogue. Open a service to compare the barbers who provide it.'
  : 'Актуальні послуги, ціни й тривалість із публічного каталогу Soul Cuts. Відкрийте послугу, щоб переглянути майстрів, які її виконують.')
const links = computed(() => locale.value === 'en'
  ? {
      booking: 'Book online',
      journal: 'Soul Cuts Journal',
      local: 'Barbershop in Odesa',
      masters: 'Meet the barbers',
    }
  : {
      booking: 'Записатися онлайн',
      journal: 'Журнал Soul Cuts',
      local: 'Барбершоп в Одесі',
      masters: 'Познайомитися з майстрами',
    })
const structuredServices = computed(() =>
  activeServices.value.map(service => ({
    name: localizedService.serviceName(service),
    description: localizedService.serviceDescription(service),
    price: service.active_promotion?.promotional_price ?? service.price,
    durationMinutes: service.duration_minutes,
  })),
)

useSeo(
  () => terms.value.seo.servicesTitle,
  pageIntro,
)
useServiceCatalogStructuredData(structuredServices)
</script>

<template>
  <div class="bg-stone-100">
    <section class="section-y pb-0">
      <div class="site-container grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(18rem,0.4fr)] lg:items-end">
        <div class="max-w-4xl" data-reveal="soft">
          <SectionLabel>{{ terms.pages.services.label }}</SectionLabel>
          <h1 class="type-page-title mt-4 text-4xl text-stone-950 md:text-6xl">
            {{ terms.pages.services.title }}
          </h1>
          <p class="mt-5 max-w-3xl text-base leading-8 text-stone-700 md:text-lg">
            {{ pageIntro }}
          </p>
        </div>
        <nav class="flex flex-col items-start gap-3 text-sm font-semibold text-stone-700" :aria-label="terms.pages.services.title">
          <NuxtLink to="/masters" class="transition hover:text-stone-950">
            <BaseHoverUnderlineText>{{ links.masters }}</BaseHoverUnderlineText>
          </NuxtLink>
          <NuxtLink to="/barbershop-odesa" class="transition hover:text-stone-950">
            <BaseHoverUnderlineText>{{ links.local }}</BaseHoverUnderlineText>
          </NuxtLink>
          <a href="/blog/" class="transition hover:text-stone-950">
            <BaseHoverUnderlineText>{{ links.journal }}</BaseHoverUnderlineText>
          </a>
          <BaseButton to="/#booking" class="mt-2">{{ links.booking }}</BaseButton>
        </nav>
      </div>
    </section>
    <ServicesGrid :services="activeServices" />
  </div>
</template>

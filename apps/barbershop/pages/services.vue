<script setup lang="ts">
import { AppSection } from '@shared-ui'

const { terms } = useTerms()
const domain = useBarbershopDomain()
const localizedService = useLocalizedService()
const { data: services } = await useAsyncData('service-catalog', domain.getServiceCatalog)
const activeServices = computed(() => activeCatalogItems(services.value))

useSeo(
  () => terms.value.seo.servicesTitle,
  () => terms.value.seo.servicesDescription,
)
</script>

<template>
  <AppSection :eyebrow="terms.pages.services.label" :title="terms.pages.services.title" :description="terms.pages.services.description">
    <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="(service, index) in activeServices" :key="service.catalog_id" class="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-stone-200" data-reveal="soft" :data-reveal-delay="Math.min(index, 5) * 70">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-2xl font-semibold text-stone-900">{{ localizedService.serviceName(service) }}</h3>
            <p class="mt-2 text-sm leading-7 text-stone-600">{{ localizedService.serviceDescription(service) }}</p>
          </div>
          <span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">
            {{ localizedService.serviceDuration(service.duration_minutes) }}
          </span>
        </div>
        <p class="mt-6 text-3xl font-semibold text-stone-900">{{ localizedService.servicePrice(service.price) }}</p>
      </article>
    </div>
  </AppSection>
</template>

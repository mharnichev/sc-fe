<script setup lang="ts">
import type { ServiceCatalogItemDto } from '@shared-types'

const { terms } = useTerms()
const domain = useBarbershopDomain()

const { data: serviceCatalog, pending: servicesPending } = await useAsyncData('home-services-catalog', domain.getServiceCatalog)

const servicePriceValue = (service: ServiceCatalogItemDto) => {
  const value = typeof service.price === 'number'
    ? service.price
    : Number.parseFloat(String(service.price).replace(/[^\d.,]/g, '').replace(',', '.'))

  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER
}

const baseServices = computed(() =>
  [...(serviceCatalog.value || [])]
    .filter(service => service.source_type === 'base' && service.barber_services.length)
    .sort((first, second) => servicePriceValue(first) - servicePriceValue(second)),
)

const formatServicePrice = (service: ServiceCatalogItemDto) => `від ₴ ${service.price}`
const formatServiceDuration = (service: ServiceCatalogItemDto) =>
  service.duration_minutes ? `${service.duration_minutes} хв` : ''

const selectService = async (service: ServiceCatalogItemDto) => {
  if (import.meta.client) {
    window.dispatchEvent(new CustomEvent('barbershop:select-service', {
      detail: { catalogId: service.catalog_id },
    }))
  }

  await nextTick()
  document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section id="services" data-header-theme="light" class="section-y-tight bg-stone-100">
    <div class="site-container">
      <div class="mb-8 flex flex-col justify-between gap-4 border-b border-neutral-300 pb-6 md:mb-12 md:flex-row md:items-end md:gap-6 md:pb-8" data-reveal="soft">
        <div>
          <SectionLabel>{{ terms.home.services.label }}</SectionLabel>
          <h2 class="section-title mt-4">
            {{ terms.home.services.title }}
          </h2>
        </div>
        <p class="max-w-md text-base leading-7 text-neutral-600 md:leading-8">
          {{ terms.home.services.description }}
        </p>
      </div>

      <div v-if="servicesPending" class="border-y border-neutral-300 py-8 text-sm text-neutral-500">
        {{ terms.home.services.loading }}
      </div>

      <div v-else-if="!baseServices.length" class="border-y border-neutral-300 py-8 text-sm text-neutral-500">
        {{ terms.home.services.empty }}
      </div>

      <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        <article v-for="(service, index) in baseServices" :key="service.catalog_id" class="border-t border-neutral-950 pt-5" data-reveal="soft" :data-reveal-delay="Math.min(index, 5) * 70">
          <button
            type="button"
            class="grid h-full w-full gap-4 px-4 py-4 text-left transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm md:gap-5 md:py-5"
            @click="selectService(service)"
          >
            <div class="flex items-start justify-between gap-5">
              <h3 class="text-xl font-semibold text-neutral-950">
                {{ service.name }}
              </h3>
              <p class="shrink-0 text-sm font-semibold text-neutral-950">
                {{ formatServicePrice(service) }}
              </p>
            </div>
            <p class="text-sm leading-6 text-neutral-600 md:leading-7">
              {{ service.description || terms.home.services.noDescription }}
            </p>
            <span class="flex items-center justify-between gap-4 border-t border-neutral-300 pt-4 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              <span>{{ formatServiceDuration(service) }}</span>
              <span>{{ terms.home.services.choose }}</span>
            </span>
          </button>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ServiceCatalogItemDto } from '@shared-types'

const { terms } = useTerms()
const domain = useBarbershopDomain()
const localizedService = useLocalizedService()
const { trackEvent } = useAnalytics()

const { data: serviceCatalog, pending: servicesPending } = await useAsyncData('home-services-catalog', domain.getServiceCatalog)

const servicePriceValue = (service: ServiceCatalogItemDto) => {
  const value = typeof service.price === 'number'
    ? service.price
    : Number.parseFloat(String(service.price).replace(/[^\d.,]/g, '').replace(',', '.'))

  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER
}

const compareServices = (first: ServiceCatalogItemDto, second: ServiceCatalogItemDto) => {
  const firstIsArmyClient = Boolean(first.is_army_client)
  const secondIsArmyClient = Boolean(second.is_army_client)

  if (firstIsArmyClient !== secondIsArmyClient) {
    return firstIsArmyClient ? 1 : -1
  }

  return servicePriceValue(first) - servicePriceValue(second)
}

const baseServices = computed(() =>
  activeBaseCatalogItems(serviceCatalog.value)
    .sort(compareServices),
)

const formatServicePrice = (service: ServiceCatalogItemDto) => localizedService.servicePrice(service.price, { from: true })
const formatServiceDuration = (service: ServiceCatalogItemDto) =>
  localizedService.serviceDuration(service.duration_minutes)

const selectService = async (service: ServiceCatalogItemDto) => {
  trackEvent('select_service', {
    source: 'services_grid',
    service_id: service.catalog_id,
    service_name: localizedService.serviceName(service),
    value: Number(service.price || 0),
    currency: 'UAH',
  })
  trackEvent('booking_start', {
    source: 'services_grid',
  })

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
      <div class="mb-8 flex flex-col justify-between gap-4 pb-6 md:mb-12 md:flex-row md:items-end md:gap-6 md:pb-8" data-reveal="soft">
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
        <article
          v-for="(service, index) in baseServices"
          :key="service.catalog_id"
          class="border-t border-neutral-950 pt-5"
          :class="service.is_army_client ? 'is-army-service light-bg-army' : ''"
          data-reveal="soft"
          :data-reveal-delay="Math.min(index, 5) * 70"
        >
          <button
            type="button"
            class="grid h-full w-full gap-4 px-4 py-4 text-left transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm md:gap-5 md:py-5"
            @click="selectService(service)"
          >
            <div class="flex items-start justify-between gap-5">
              <h3 class="flex min-w-0 items-center gap-[10px] text-xl font-semibold text-neutral-950">
                <img
                  v-if="service.is_army_client"
                  src="~/assets/images/services/army-logo.webp"
                  alt=""
                  class="h-7 w-7 shrink-0 object-contain"
                  aria-hidden="true"
                >
                {{ localizedService.serviceName(service) }}
              </h3>
              <p class="shrink-0 text-sm font-semibold text-neutral-950">
                {{ formatServicePrice(service) }}
              </p>
            </div>
            <p class="text-sm leading-6 text-neutral-600 md:leading-7">
              {{ localizedService.serviceDescription(service) || terms.home.services.noDescription }}
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

<style scoped>
.light-bg-army > button {
  background-image:
    linear-gradient(rgb(255 255 255 / 0.56), rgb(255 255 255 / 0.7)),
    url('~/assets/images/services/light-bg-army.webp');
  background-position: center;
  background-size: cover;
}

.light-bg-army > button:hover {
  background-image:
    linear-gradient(rgb(255 255 255 / 0.44), rgb(255 255 255 / 0.62)),
    url('~/assets/images/services/light-bg-army.webp');
}
</style>

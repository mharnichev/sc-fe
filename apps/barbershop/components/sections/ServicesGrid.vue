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
  const firstHasPromotion = Boolean(first.active_promotion)
  const secondHasPromotion = Boolean(second.active_promotion)

  if (firstHasPromotion !== secondHasPromotion) {
    return firstHasPromotion ? 1 : -1
  }

  return servicePriceValue(first) - servicePriceValue(second)
}

const baseServices = computed(() =>
  activeBaseCatalogItems(serviceCatalog.value)
    .sort(compareServices),
)

const formatServicePrice = (service: ServiceCatalogItemDto) =>
  localizedService.servicePrice(service.active_promotion?.promotional_price ?? service.price, { from: true })
const formatServiceRegularPrice = (service: ServiceCatalogItemDto) =>
  localizedService.servicePrice(service.price, { from: true })
const formatServiceDuration = (service: ServiceCatalogItemDto) =>
  localizedService.serviceDuration(service.duration_minutes)
const promotionLabel = (service: ServiceCatalogItemDto) =>
  service.active_promotion ? `-${service.active_promotion.discount_percent}%` : ''

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
          :class="service.active_promotion ? 'is-promoted-service' : ''"
          data-reveal="soft"
          :data-reveal-delay="Math.min(index, 5) * 70"
        >
          <button
            type="button"
            class="service-card grid h-full w-full gap-4 overflow-hidden px-4 py-4 text-left transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm md:gap-5 md:py-5"
            :class="service.active_promotion ? 'service-card--promotion' : ''"
            @click="selectService(service)"
          >
            <div class="flex items-start justify-between gap-5">
              <h3 class="min-w-0 text-xl font-semibold text-neutral-950">
                {{ localizedService.serviceName(service) }}
              </h3>
              <p class="flex shrink-0 flex-col items-end gap-0.5 text-sm font-semibold text-neutral-950">
                <span v-if="service.active_promotion" class="text-xs font-medium text-neutral-500 line-through">{{ formatServiceRegularPrice(service) }}</span>
                <span>{{ formatServicePrice(service) }}</span>
              </p>
            </div>
            <p class="text-sm leading-6 text-neutral-600 md:leading-7">
              {{ localizedService.serviceDescription(service) || terms.home.services.noDescription }}
            </p>
            <span class="flex items-center justify-between gap-4 border-t border-neutral-300 pt-4 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              <span>{{ formatServiceDuration(service) }}</span>
              <span>{{ terms.home.services.choose }}</span>
            </span>
            <span
              v-if="service.active_promotion"
              class="service-army-strip flex items-center justify-between gap-2 overflow-hidden px-3 py-2 text-neutral-950"
            >
              <span class="flex min-w-0 items-center gap-2">
                <img
                  src="~/assets/images/services/army-logo.webp"
                  alt=""
                  class="h-5 w-5 shrink-0 object-contain"
                  aria-hidden="true"
                >
                <span class="truncate text-[0.62rem] font-semibold uppercase tracking-[0.08em]">{{ service.active_promotion.name_uk }}</span>
              </span>
              <span class="service-army-discount shrink-0 text-xs font-bold leading-none text-white">{{ promotionLabel(service) }}</span>
            </span>
          </button>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.service-card {
  position: relative;
  isolation: isolate;
}

.service-card--promotion {
  padding-bottom: 3.25rem;
}

.service-army-strip {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  background-image:
    linear-gradient(90deg, rgb(255 255 255 / 0.82), rgb(255 255 255 / 0.3)),
    url('~/assets/images/services/light-bg-army.webp');
  background-position: center;
  background-size: cover;
}

.service-army-discount {
  position: relative;
  isolation: isolate;
  padding: 0.2rem 0.35rem;
  padding-right: 22px;
  font-weight: 800;
}

.service-army-discount::before {
  content: "";
  position: absolute;
  inset: -0.8rem -1.65rem;
  z-index: -1;
  background:
    linear-gradient(90deg, rgb(255 255 255 / 0.08), rgb(0 0 0 / 0.1)),
    repeating-linear-gradient(179deg, rgb(255 255 255 / 0.04) 0 1px, transparent 1px 5px),
    repeating-linear-gradient(-40deg, rgb(0 0 0 / 0.08) 0 1px, transparent 1px 5px),
    #0045a9;
  border-top: 2px solid #f2bf0b;
  border-bottom: 2px solid #f2bf0b;
  transform: rotate(-45deg) translateY(-6px);
  transform-origin: center;
}

.service-army-discount::after {
  content: "";
  position: absolute;
  inset: -0.45rem;
  z-index: -2;
  border-radius: 9999px;
  background: rgb(0 0 0 / 0.08);
}
</style>

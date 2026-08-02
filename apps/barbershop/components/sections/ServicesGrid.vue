<script setup lang="ts">
import type { ServiceCatalogItemDto } from '@shared-types'
import FeedbackState from '~/components/ui/FeedbackState.vue'
import type { PublicServiceCatalogItemDto } from '~/utils/seoRoutes'

const props = withDefaults(defineProps<{
  services?: readonly PublicServiceCatalogItemDto[]
  sectionLabel?: string
  sectionTitle?: string
  sectionDescription?: string
  showCatalogueLink?: boolean
  preserveCatalogItems?: boolean
  priceFrom?: boolean
}>(), {
  services: () => [],
  sectionLabel: '',
  sectionTitle: '',
  sectionDescription: '',
  showCatalogueLink: false,
  preserveCatalogItems: false,
  priceFrom: true,
})

const { locale, terms } = useTerms()
const domain = useBarbershopDomain()
const localizedService = useLocalizedService()
const { trackEvent } = useAnalytics()
const route = useRoute()
const servicesSection = ref<HTMLElement | null>(null)
const hasRequestedServices = ref(props.services.length > 0)
let serviceCatalogObserver: IntersectionObserver | null = null

const { data: serviceCatalog, pending: servicesPending, execute: loadServicesCatalog } = await useAsyncData('home-services-catalog', domain.getServiceCatalog, {
  server: false,
  immediate: false,
  default: () => [],
})

const requestServicesCatalog = () => {
  if (hasRequestedServices.value || props.services.length) return

  hasRequestedServices.value = true
  serviceCatalogObserver?.disconnect()
  serviceCatalogObserver = null
  void loadServicesCatalog()
}

const showServicesSkeleton = computed(() =>
  props.services.length
    ? false
    : !hasRequestedServices.value || servicesPending.value,
)

onMounted(() => {
  if (props.services.length) return

  const target = servicesSection.value

  if (!target || typeof window.IntersectionObserver !== 'function') {
    window.setTimeout(requestServicesCatalog, 2500)
    return
  }

  serviceCatalogObserver = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return

    requestServicesCatalog()
  }, {
    rootMargin: '360px 0px',
  })

  serviceCatalogObserver.observe(target)
})

onBeforeUnmount(() => {
  serviceCatalogObserver?.disconnect()
})

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

const baseServices = computed(() => {
  const sourceServices = props.services.length ? [...props.services] : serviceCatalog.value
  const activeServices = props.preserveCatalogItems
    ? activeCatalogItems(sourceServices)
    : activeBaseCatalogItems(sourceServices)

  return activeServices.sort(compareServices)
})
const indexableServiceIds = computed(() =>
  new Set(indexableServiceCatalog(props.services.length ? props.services : serviceCatalog.value)
    .map(service => serviceStableId(service))),
)
const serviceDetailPath = (service: ServiceCatalogItemDto) =>
  indexableServiceIds.value.has(serviceStableId(service))
    ? serviceSeoPath(service)
    : ''
const detailLabel = computed(() => locale.value === 'en' ? 'Service details' : 'Деталі послуги')
const catalogueLabel = computed(() => locale.value === 'en' ? 'Full service catalogue' : 'Усі послуги')
const bookingLabel = computed(() => locale.value === 'en' ? 'Book' : 'Записатися')
const displaySectionLabel = computed(() => props.sectionLabel || terms.value.home.services.label)
const displaySectionTitle = computed(() => props.sectionTitle || terms.value.home.services.title)
const displaySectionDescription = computed(() => props.sectionDescription || terms.value.home.services.description)

const formatServicePrice = (service: ServiceCatalogItemDto) =>
  localizedService.servicePrice(service.active_promotion?.promotional_price ?? service.price, { from: props.priceFrom })
const formatServiceRegularPrice = (service: ServiceCatalogItemDto) =>
  localizedService.servicePrice(service.price, { from: props.priceFrom })
const formatServiceDuration = (service: ServiceCatalogItemDto) =>
  localizedService.serviceDuration(service.duration_minutes)
const promotionLabel = (service: ServiceCatalogItemDto) =>
  service.active_promotion ? `-${service.active_promotion.discount_percent}%` : ''

const selectService = async (service: ServiceCatalogItemDto) => {
  trackEvent('service_cta_click', {
    source: 'services_grid',
    service_id: service.catalog_id,
    service_name: localizedService.serviceName(service),
    value: Number(service.price || 0),
    currency: 'UAH',
  })
  trackEvent('booking_cta_click', {
    source: 'services_grid',
  })

  if (route.path !== '/') {
    await navigateTo('/#booking')
    return
  }

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
  <section id="services" ref="servicesSection" data-header-theme="light" class="section-y-tight bg-stone-100">
    <div class="site-container">
      <div class="mb-8 flex flex-col justify-between gap-4 pb-6 md:mb-12 md:flex-row md:items-end md:gap-6 md:pb-8" data-reveal="soft">
        <div>
          <SectionLabel>{{ displaySectionLabel }}</SectionLabel>
          <h2 class="section-title mt-4">
            {{ displaySectionTitle }}
          </h2>
        </div>
        <div class="max-w-md">
          <p class="text-base leading-7 text-neutral-600 md:leading-8">
            {{ displaySectionDescription }}
          </p>
          <NuxtLink
            v-if="route.path === '/' || showCatalogueLink"
            to="/services"
            class="type-meta mt-4 block w-fit text-sm font-semibold text-neutral-700 transition hover:text-neutral-950"
          >
            <BaseHoverUnderlineText>{{ catalogueLabel }}</BaseHoverUnderlineText>
          </NuxtLink>
        </div>
      </div>

      <div
        v-if="showServicesSkeleton"
        class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5"
        aria-busy="true"
        aria-live="polite"
      >
        <div
          v-for="index in 6"
          :key="index"
          class="service-card service-card--skeleton grid min-h-[11rem] gap-4 px-4 py-4 md:min-h-[12rem] md:gap-5 md:py-5"
          aria-hidden="true"
        >
          <span class="h-6 w-3/4 bg-neutral-950/10" />
          <span class="h-4 w-full bg-neutral-950/10" />
          <span class="h-4 w-5/6 bg-neutral-950/10" />
          <span class="service-card__meta mt-auto flex items-center justify-between gap-4 px-3 py-3">
            <span class="h-3 w-16 bg-neutral-950/10" />
            <span class="h-3 w-20 bg-neutral-950/10" />
          </span>
        </div>
        <span class="sr-only">{{ terms.home.services.loading }}</span>
      </div>

      <FeedbackState
        v-else-if="!baseServices.length"
        class="bg-white/55 text-neutral-950"
        kind="unavailable"
        face="sad-droopy-face"
        :title="terms.home.services.empty"
        style="--feedback-state-surface: #f5f5f4"
      />

      <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        <article
          v-for="(service, index) in baseServices"
          :key="service.catalog_id"
          class="service-card relative grid h-full w-full gap-4 overflow-hidden px-4 py-4 text-left transition duration-300 hover:-translate-y-0.5 md:gap-5 md:py-5"
          :class="service.active_promotion ? 'service-card--promotion is-promoted-service' : ''"
          data-reveal="soft"
          :data-reveal-delay="Math.min(index, 5) * 70"
        >
          <button
            type="button"
            class="service-card__summary grid w-full gap-4 text-left"
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
          </button>
          <NuxtLink
            v-if="serviceDetailPath(service)"
            :to="serviceDetailPath(service)"
            class="service-detail-link type-meta -mt-1 w-fit text-[10px] font-semibold text-neutral-600 transition hover:text-neutral-950"
          >
            <BaseHoverUnderlineText>{{ detailLabel }}</BaseHoverUnderlineText>
          </NuxtLink>
          <button
            type="button"
            class="service-card__booking service-card__meta type-eyebrow flex items-center justify-between gap-4 px-3 py-3 text-xs text-neutral-500"
            @click="selectService(service)"
          >
            <span>{{ formatServiceDuration(service) }}</span>
            <span>{{ route.path === '/' ? terms.home.services.choose : bookingLabel }}</span>
          </button>
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
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.service-card {
  position: relative;
  isolation: isolate;
  cursor: pointer;
  background: rgb(255 255 255 / 0.62);
}

.service-card:hover,
.service-card:has(.service-card__summary:focus-visible),
.service-card:has(.service-card__booking:focus-visible) {
  background: rgb(255 255 255 / 0.74);
}

.service-card__summary:focus-visible,
.service-card__booking:focus-visible {
  outline: none;
}

.service-card__meta {
  background: rgb(23 23 23 / 0.035);
}

.service-detail-link {
  position: relative;
  z-index: 2;
  font-size: 10px;
  line-height: 1.25;
  text-decoration: none;
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

<script setup lang="ts">
import type { MasterDto } from '@shared-types'
import {
  indexablePublicMasters,
  indexableServiceCatalog,
  masterProfileName,
  masterSeoPath,
  serviceSeoPath,
  serviceSeoSlug,
  type PublicMasterDto,
  type PublicServiceCatalogItemDto,
  type PublicServiceDto,
} from '~/utils/seoRoutes'

definePageMeta({
  key: route => route.path,
})

const route = useRoute()
const { locale, terms } = useTerms()
const domain = useBarbershopDomain()
const localizedService = useLocalizedService()

const publicAssetUrl = (value: MasterDto['photo']) => {
  if (typeof value === 'string') return value.trim()
  return value?.file_url?.trim() || ''
}

const publicService = (service: PublicServiceDto): PublicServiceDto => ({
  id: service.id,
  barber_id: service.barber_id,
  base_service_id: service.base_service_id,
  source_type: service.source_type,
  name: service.name,
  title_uk: service.title_uk,
  title_en: service.title_en,
  slug: service.slug,
  description: service.description,
  description_uk: service.description_uk,
  description_en: service.description_en,
  price: service.price,
  duration_minutes: service.duration_minutes,
  status: service.status,
  is_active: service.is_active,
  active_promotion: service.active_promotion,
  created_at: service.created_at,
  updated_at: service.updated_at,
})

const publicMaster = (master: PublicMasterDto): PublicMasterDto => ({
  id: master.id,
  name: master.name,
  full_name: master.full_name,
  last_name: master.last_name,
  first_name_uk: master.first_name_uk,
  last_name_uk: master.last_name_uk,
  first_name_en: master.first_name_en,
  last_name_en: master.last_name_en,
  full_name_uk: master.full_name_uk,
  full_name_en: master.full_name_en,
  position: master.position,
  position_uk: master.position_uk,
  position_en: master.position_en,
  title: master.title,
  title_uk: master.title_uk,
  title_en: master.title_en,
  slug: master.slug,
  description: master.description,
  description_uk: master.description_uk,
  description_en: master.description_en,
  bio: master.bio,
  bio_uk: master.bio_uk,
  bio_en: master.bio_en,
  photo_url: master.photo_url?.trim() || publicAssetUrl(master.photo) || null,
  avatar_url: master.avatar_url?.trim() || publicAssetUrl(master.avatar) || null,
  status: master.status,
  is_active: master.is_active,
  showOnMasterBlock: master.showOnMasterBlock,
  show_on_master_block: master.show_on_master_block,
  services: (master.services || []).map(service => publicService(service as PublicServiceDto)),
})

const [
  { data: serviceCatalog, error: serviceCatalogError },
  { data: masters },
] = await Promise.all([
  useAsyncData(
    'service-detail-catalog',
    async () => await domain.getServiceCatalog() as PublicServiceCatalogItemDto[],
    { default: () => [] },
  ),
  useAsyncData(
    'service-detail-masters',
    async () => {
      try {
        return (await domain.getMasters() as PublicMasterDto[]).map(publicMaster)
      }
      catch {
        return []
      }
    },
    { default: () => [] },
  ),
])

if (serviceCatalogError.value) {
  throw createError({
    statusCode: 502,
    statusMessage: 'Service catalog unavailable',
  })
}

const routeSlug = Array.isArray(route.params.slug)
  ? route.params.slug[0] || ''
  : String(route.params.slug || '')
const service = indexableServiceCatalog(serviceCatalog.value)
  .find(item => serviceSeoSlug(item) === routeSlug)

if (!service) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Service not found',
  })
}

const servicePath = serviceSeoPath(service)
const serviceName = computed(() => localizedService.serviceName(service))
const serviceDescription = computed(() => localizedService.serviceDescription(service))
const indexableMasters = computed(() => indexablePublicMasters(masters.value))
const indexableMastersById = computed(() =>
  new Map(indexableMasters.value.map(master => [master.id, master])),
)

const localizedMasterName = (master: PublicMasterDto) => {
  if (locale.value === 'en') {
    return master.full_name_en?.trim()
      || master.full_name?.trim()
      || master.full_name_uk?.trim()
      || master.first_name_en?.trim()
      || masterProfileName(master)
  }

  return masterProfileName(master)
}

const barberOffers = computed(() =>
  service.barber_services.flatMap((offer) => {
    const master = indexableMastersById.value.get(offer.barber_id)
    const path = master ? masterSeoPath(master) : ''
    if (!master || !path) return []

    return [{
      id: offer.id,
      durationMinutes: offer.duration_minutes,
      master,
      name: localizedMasterName(master),
      path,
      price: offer.active_promotion?.promotional_price ?? offer.price,
    }]
  }),
)

const numberValue = (value: string | number | null | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (!value) return null

  const parsed = Number.parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

const sortedUniqueValues = (values: Array<number | null>) =>
  [...new Set(values.filter((value): value is number => value !== null))]
    .sort((first, second) => first - second)

const offerPrices = sortedUniqueValues(service.barber_services.map(offer =>
  numberValue(offer.active_promotion?.promotional_price ?? offer.price),
))
const offerDurations = sortedUniqueValues(service.barber_services.map(offer =>
  offer.duration_minutes > 0 ? offer.duration_minutes : null,
))

const priceSummary = computed(() => {
  const values = offerPrices.length ? offerPrices : sortedUniqueValues([numberValue(service.price)])
  if (!values.length) return ''

  const first = localizedService.servicePrice(values[0])
  const last = localizedService.servicePrice(values[values.length - 1])
  return values.length === 1 ? first : `${first}–${last}`
})

const durationSummary = computed(() => {
  const values = offerDurations.length
    ? offerDurations
    : sortedUniqueValues([service.duration_minutes > 0 ? service.duration_minutes : null])
  if (!values.length) return ''

  const suffix = locale.value === 'en' ? 'min' : 'хв'
  return values.length === 1
    ? `${values[0]} ${suffix}`
    : `${values[0]}–${values[values.length - 1]} ${suffix}`
})

const copy = computed(() => locale.value === 'en'
  ? {
      barbersTitle: 'Barbers offering this service',
      bookingCta: 'Book online',
      bookingText: 'Choose this service, a barber, date and time in the online booking form.',
      breadcrumbLabel: 'Service breadcrumbs',
      duration: 'Duration',
      faqTitle: 'Price and duration',
      journal: 'Soul Cuts Journal',
      local: 'Barbershop in Odesa',
      price: 'Price',
      relatedTitle: 'More from Soul Cuts',
      services: 'All services',
    }
  : {
      barbersTitle: 'Барбери, які надають цю послугу',
      bookingCta: 'Записатися онлайн',
      bookingText: 'Оберіть цю послугу, барбера, дату та час у формі онлайн-запису.',
      breadcrumbLabel: 'Навігація сторінкою послуги',
      duration: 'Тривалість',
      faqTitle: 'Ціна та тривалість',
      journal: 'Журнал Soul Cuts',
      local: 'Барбершоп в Одесі',
      price: 'Вартість',
      relatedTitle: 'Більше про Soul Cuts',
      services: 'Усі послуги',
    })

const seoTitle = computed(() =>
  locale.value === 'en'
    ? `${serviceName.value} in Odesa`
    : `${serviceName.value} в Одесі`,
)
const sentence = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return ''
  return /[.!?…]$/.test(normalized) ? normalized : `${normalized}.`
}
const seoDescription = computed(() =>
  [
    sentence(serviceDescription.value),
    priceSummary.value ? `${copy.value.price}: ${priceSummary.value}.` : '',
    durationSummary.value ? `${copy.value.duration}: ${durationSummary.value}.` : '',
  ].filter(Boolean).join(' '),
)

const faqItems = computed(() => [
  ...(priceSummary.value
    ? [{
        question: locale.value === 'en'
          ? `How much does “${serviceName.value}” cost?`
          : `Скільки коштує послуга «${serviceName.value}»?`,
        answer: locale.value === 'en'
          ? `The price shown in the Soul Cuts public catalogue is ${priceSummary.value}.`
          : `Вартість у публічному каталозі Soul Cuts — ${priceSummary.value}.`,
      }]
    : []),
  ...(durationSummary.value
    ? [{
        question: locale.value === 'en'
          ? `How long does “${serviceName.value}” take?`
          : `Скільки триває послуга «${serviceName.value}»?`,
        answer: locale.value === 'en'
          ? `The duration shown in the Soul Cuts public catalogue is ${durationSummary.value}.`
          : `Тривалість у публічному каталозі Soul Cuts — ${durationSummary.value}.`,
      }]
    : []),
])

useSeo(
  seoTitle,
  seoDescription,
  {
    path: servicePath,
    breadcrumbs: () => [
      { name: terms.value.pages.services.title, path: '/services' },
      { name: serviceName.value, path: servicePath },
    ],
  },
)
useServiceStructuredData(() => ({
  name: serviceName.value,
  description: serviceDescription.value,
  durationMinutes: offerDurations.length === 1 ? offerDurations[0] : null,
  path: servicePath,
  offers: service.barber_services.map((offer) => {
    const master = indexableMastersById.value.get(offer.barber_id)
    return {
      durationMinutes: offer.duration_minutes,
      name: master
        ? `${serviceName.value} — ${localizedMasterName(master)}`
        : serviceName.value,
      price: offer.active_promotion?.promotional_price ?? offer.price,
    }
  }),
}))
if (faqItems.value.length) {
  useFaqStructuredData(faqItems)
}
</script>

<template>
  <div class="bg-stone-100">
    <section class="section-y">
      <div class="site-container">
        <nav :aria-label="copy.breadcrumbLabel" class="mb-10 text-sm text-stone-600">
          <ol class="flex flex-wrap items-center gap-2">
            <li>
              <NuxtLink to="/services" class="transition hover:text-stone-950">
                <BaseHoverUnderlineText>{{ copy.services }}</BaseHoverUnderlineText>
              </NuxtLink>
            </li>
            <li aria-hidden="true">/</li>
            <li class="text-stone-950" aria-current="page">{{ serviceName }}</li>
          </ol>
        </nav>

        <div class="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(18rem,0.28fr)] lg:items-start">
          <div class="max-w-4xl">
            <SectionLabel>{{ terms.home.services.label }}</SectionLabel>
            <h1 class="type-page-title mt-4 text-4xl text-stone-950 md:text-6xl">
              {{ serviceName }}
            </h1>
            <p class="mt-6 max-w-3xl text-lg leading-8 text-stone-700">
              {{ serviceDescription }}
            </p>

            <dl class="mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
              <div v-if="priceSummary" class="border-t border-stone-300 pt-4">
                <dt class="type-meta text-xs text-stone-500">{{ copy.price }}</dt>
                <dd class="mt-2 text-xl font-semibold text-stone-950">{{ priceSummary }}</dd>
              </div>
              <div v-if="durationSummary" class="border-t border-stone-300 pt-4">
                <dt class="type-meta text-xs text-stone-500">{{ copy.duration }}</dt>
                <dd class="mt-2 text-xl font-semibold text-stone-950">{{ durationSummary }}</dd>
              </div>
            </dl>
          </div>

          <aside class="service-booking-card border border-stone-300 bg-white p-6">
            <p class="text-sm leading-7 text-stone-700">{{ copy.bookingText }}</p>
            <BaseButton to="/#booking" class="mt-5">
              {{ copy.bookingCta }}
            </BaseButton>
          </aside>
        </div>
      </div>
    </section>

    <section v-if="barberOffers.length" class="border-y border-stone-300 bg-white section-y">
      <div class="site-container">
        <h2 class="type-section-title text-3xl text-stone-950 md:text-4xl">
          {{ copy.barbersTitle }}
        </h2>
        <div class="mt-8 grid gap-4 md:grid-cols-2">
          <article
            v-for="offer in barberOffers"
            :key="offer.id"
            class="border border-stone-200 bg-stone-50 p-5"
          >
            <NuxtLink
              :to="offer.path"
              class="text-xl font-semibold text-stone-950"
            >
              <BaseHoverUnderlineText>{{ offer.name }}</BaseHoverUnderlineText>
            </NuxtLink>
            <dl class="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm text-stone-700">
              <div>
                <dt class="type-meta text-xs text-stone-500">{{ copy.price }}</dt>
                <dd class="mt-1 font-semibold text-stone-950">{{ localizedService.servicePrice(offer.price) }}</dd>
              </div>
              <div>
                <dt class="type-meta text-xs text-stone-500">{{ copy.duration }}</dt>
                <dd class="mt-1 font-semibold text-stone-950">{{ localizedService.serviceDuration(offer.durationMinutes) }}</dd>
              </div>
            </dl>
          </article>
        </div>
      </div>
    </section>

    <section v-if="faqItems.length" class="section-y">
      <div class="site-container max-w-4xl">
        <h2 class="type-section-title text-3xl text-stone-950 md:text-4xl">
          {{ copy.faqTitle }}
        </h2>
        <div class="mt-8 divide-y divide-stone-300 border-y border-stone-300">
          <article v-for="item in faqItems" :key="item.question" class="py-6">
            <h3 class="text-xl font-semibold text-stone-950">{{ item.question }}</h3>
            <p class="mt-3 text-base leading-7 text-stone-700">{{ item.answer }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="border-t border-stone-300 bg-white py-10">
      <div class="site-container">
        <h2 class="type-meta text-xs text-stone-500">{{ copy.relatedTitle }}</h2>
        <nav class="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-stone-800" :aria-label="copy.relatedTitle">
          <NuxtLink to="/services">
            <BaseHoverUnderlineText>{{ copy.services }}</BaseHoverUnderlineText>
          </NuxtLink>
          <NuxtLink to="/barbershop-odesa">
            <BaseHoverUnderlineText>{{ copy.local }}</BaseHoverUnderlineText>
          </NuxtLink>
          <a href="/blog/">
            <BaseHoverUnderlineText>{{ copy.journal }}</BaseHoverUnderlineText>
          </a>
        </nav>
      </div>
    </section>
  </div>
</template>

<style scoped>
.service-booking-card {
  box-shadow: 0 1.25rem 3rem rgb(28 25 23 / 0.06);
}
</style>

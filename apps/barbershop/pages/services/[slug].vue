<script setup lang="ts">
import type { MasterDto } from '@shared-types'
import { serviceGuide } from '~/data/serviceGuides'
import { seoBookingPath } from '~/utils/seoBooking'
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
const { offers } = useBookingPromotions()

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
const firstVisitOffer = computed(() => firstVisitOffers(offers.value)
  .find(offer => offer.applies_to_all_masters && offerAppliesToService(offer, serviceStableId(service))) || null)
const serviceName = computed(() => localizedService.serviceName(service))
const serviceDescription = computed(() => localizedService.serviceDescription(service))
const guide = computed(() => serviceGuide(service.base_service_id, service.title_uk || service.name, locale.value))
const relatedServices = computed(() => indexableServiceCatalog(serviceCatalog.value)
  .filter(item => guide.value?.relatedServiceIds.includes(item.base_service_id ?? 0))
  .map(item => ({ name: localizedService.serviceName(item), path: serviceSeoPath(item) })))
const bookingPath = seoBookingPath({ serviceSlug: serviceSeoSlug(service) })
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
      price: offer.price,
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
  numberValue(offer.price),
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
      choice: 'Is this the right service?',
      duration: 'Duration',
      faqTitle: 'Questions before booking',
      journal: 'Soul Cuts Journal',
      local: 'Barbershop in Odesa',
      price: 'Price',
      preparation: 'Before your visit',
      relatedTitle: 'More from Soul Cuts',
      compareTitle: 'Compare services before booking',
      result: 'What to discuss with your barber',
      services: 'All services',
    }
  : {
      barbersTitle: 'Барбери, які надають цю послугу',
      bookingCta: 'Записатися онлайн',
      bookingText: 'Оберіть цю послугу, барбера, дату та час у формі онлайн-запису.',
      breadcrumbLabel: 'Навігація сторінкою послуги',
      choice: 'Коли обрати цю послугу',
      duration: 'Тривалість',
      faqTitle: 'Питання перед записом',
      journal: 'Журнал Soul Cuts',
      local: 'Барбершоп в Одесі',
      price: 'Вартість',
      preparation: 'Перед візитом',
      relatedTitle: 'Більше про Soul Cuts',
      compareTitle: 'Порівняйте послуги перед записом',
      result: 'Що обговорити з барбером',
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
    sentence(guide.value?.intro || serviceDescription.value),
    priceSummary.value ? `${copy.value.price}: ${priceSummary.value}.` : '',
    durationSummary.value ? `${copy.value.duration}: ${durationSummary.value}.` : '',
  ].filter(Boolean).join(' '),
)

const faqItems = computed(() => [
  ...(guide.value?.faq || []),
  ...(priceSummary.value
    ? [{
        question: locale.value === 'en'
          ? `How much does “${serviceName.value}” cost?`
          : `Скільки коштує послуга «${serviceName.value}»?`,
        answer: locale.value === 'en'
          ? `The available price is ${priceSummary.value}; the selected barber’s offer shows its exact price.`
          : `Доступна вартість — ${priceSummary.value}; точна ціна вказана в пропозиції обраного барбера.`,
      }]
    : []),
  ...(durationSummary.value
    ? [{
        question: locale.value === 'en'
          ? `How long does “${serviceName.value}” take?`
          : `Скільки триває послуга «${serviceName.value}»?`,
        answer: locale.value === 'en'
          ? `The listed appointment length is ${durationSummary.value}; check the selected barber’s offer for its time.`
          : `Тривалість запису — ${durationSummary.value}; час для обраного барбера вказаний у його пропозиції.`,
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
  description: guide.value?.intro || serviceDescription.value,
  durationMinutes: offerDurations.length === 1 ? offerDurations[0] : null,
  path: servicePath,
  offers: service.barber_services.map((offer) => {
    const master = indexableMastersById.value.get(offer.barber_id)
    return {
      durationMinutes: offer.duration_minutes,
      name: master
        ? `${serviceName.value} — ${localizedMasterName(master)}`
        : serviceName.value,
      price: offer.price,
    }
  }),
}))
if (faqItems.value.length) {
  useFaqStructuredData(faqItems)
}
</script>

<template>
  <div class="bg-stone-100">
    <section data-header-theme="light" class="section-y pt-24 sm:pt-28 md:pt-32">
      <div class="site-container">
        <nav :aria-label="copy.breadcrumbLabel" class="mb-10 text-sm text-stone-600">
          <ol class="flex flex-wrap items-center gap-2">
            <li>
              <LocaleLink to="/services" class="transition hover:text-stone-950">
                <BaseHoverUnderlineText>{{ copy.services }}</BaseHoverUnderlineText>
              </LocaleLink>
            </li>
            <li aria-hidden="true">/</li>
            <li class="service-name-wrap min-w-0 text-stone-950" aria-current="page">{{ serviceName }}</li>
          </ol>
        </nav>

        <div class="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(18rem,0.28fr)] lg:items-start">
          <div class="min-w-0 max-w-4xl">
            <SectionLabel>{{ terms.home.services.label }}</SectionLabel>
            <h1 class="service-name-wrap type-page-title mt-4 text-4xl leading-[1.08] text-stone-950 md:text-6xl">
              {{ serviceName }}
            </h1>
            <p class="mt-6 max-w-3xl text-sm leading-6 text-stone-700 md:text-lg md:leading-8">
              {{ guide?.intro || serviceDescription }}
            </p>
            <BookingPromotionNotice v-if="firstVisitOffer" :offer="firstVisitOffer" theme="light" class="mt-5 max-w-2xl" />

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
            <BaseButton :to="bookingPath" class="mt-5">
              {{ copy.bookingCta }}
            </BaseButton>
          </aside>
        </div>
      </div>
    </section>

    <section v-if="guide" class="border-y border-stone-300 bg-white section-y">
      <div class="site-container grid gap-8 md:grid-cols-3">
        <article class="border-t border-stone-300 pt-5">
          <h2 class="text-xl font-semibold text-stone-950">{{ copy.choice }}</h2>
          <p class="mt-4 text-sm leading-7 text-stone-700">{{ guide.choice }}</p>
        </article>
        <article class="border-t border-stone-300 pt-5">
          <h2 class="text-xl font-semibold text-stone-950">{{ copy.preparation }}</h2>
          <p class="mt-4 text-sm leading-7 text-stone-700">{{ guide.preparation }}</p>
        </article>
        <article class="border-t border-stone-300 pt-5">
          <h2 class="text-xl font-semibold text-stone-950">{{ copy.result }}</h2>
          <p class="mt-4 text-sm leading-7 text-stone-700">{{ guide.result }}</p>
        </article>
      </div>
    </section>

    <section v-if="relatedServices.length" class="border-b border-stone-300 bg-white py-8">
      <div class="site-container">
        <h2 class="text-xl font-semibold text-stone-950">{{ copy.compareTitle }}</h2>
        <nav class="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-stone-800" :aria-label="copy.compareTitle">
          <LocaleLink v-for="item in relatedServices" :key="item.path" :to="item.path">
            <BaseHoverUnderlineText>{{ item.name }}</BaseHoverUnderlineText>
          </LocaleLink>
        </nav>
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
            <LocaleLink
              :to="offer.path"
              class="text-xl font-semibold text-stone-950"
            >
              <BaseHoverUnderlineText>{{ offer.name }}</BaseHoverUnderlineText>
            </LocaleLink>
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
            <BaseButton :to="seoBookingPath({ serviceSlug: serviceSeoSlug(service), masterId: offer.master.id })" class="mt-5">
              {{ copy.bookingCta }}
            </BaseButton>
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
            <p class="mt-3 text-sm leading-6 text-stone-700 md:text-base md:leading-7">{{ item.answer }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="border-t border-stone-300 bg-white py-10">
      <div class="site-container">
        <h2 class="type-meta text-xs text-stone-500">{{ copy.relatedTitle }}</h2>
        <nav class="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-stone-800" :aria-label="copy.relatedTitle">
          <LocaleLink to="/services">
            <BaseHoverUnderlineText>{{ copy.services }}</BaseHoverUnderlineText>
          </LocaleLink>
          <LocaleLink to="/barbershop-odesa">
            <BaseHoverUnderlineText>{{ copy.local }}</BaseHoverUnderlineText>
          </LocaleLink>
          <a href="/blog/">
            <BaseHoverUnderlineText>{{ copy.journal }}</BaseHoverUnderlineText>
          </a>
        </nav>
      </div>
    </section>
  </div>
</template>

<style scoped>
.service-name-wrap {
  overflow-wrap: anywhere;
  word-break: normal;
  hyphens: auto;
}

.service-booking-card {
  box-shadow: 0 1.25rem 3rem rgb(28 25 23 / 0.06);
}
</style>

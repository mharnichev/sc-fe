<script setup lang="ts">
import type {
  MasterRatingSummaryDto,
  PublicMasterReviewDto,
} from '~/domain/barbershop'
import { isPublicServiceActive } from '~/composables/useActiveServiceCatalog'
import {
  indexablePublicMasters,
  indexableServiceCatalog,
  masterSeoPath,
  masterSeoSlug,
  serviceSeoPath,
  serviceStableId,
  type PublicMasterDto,
  type PublicServiceCatalogItemDto,
  type PublicServiceDto,
} from '~/utils/seoRoutes'

type BarberService = {
  durationMinutes: number
  id: number
  name: string
  path?: string
  price: string | number
}

type ApprovedReview = {
  authorName: string
  comment: string
  id: number
  publishedAt: string
  rating: number
}

type BarberTrust = {
  reviews: PublicMasterReviewDto[]
  summary: MasterRatingSummaryDto | null
}

const route = useRoute()
const domain = useBarbershopDomain()
const assetUrl = useAssetUrl()
const localizedService = useLocalizedService()
const { locale } = useTerms()
const { masterFullName } = useMasterDisplay()

const requestedSlug = Array.isArray(route.params.slug)
  ? route.params.slug[0]
  : route.params.slug

if (typeof requestedSlug !== 'string' || !requestedSlug) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Barber not found',
  })
}

const { data: source, error: sourceError } = await useAsyncData(
  `barber-profile-source-${requestedSlug}`,
  async () => {
    const [masters, catalog] = await Promise.all([
      domain.getMasters(),
      domain.getServiceCatalog(),
    ])

    return { catalog, masters }
  },
)

if (sourceError.value) {
  throw createError({
    statusCode: 503,
    statusMessage: 'Barber profiles temporarily unavailable',
  })
}

const publicMasters = indexablePublicMasters(
  (source.value?.masters || []) as PublicMasterDto[],
)
const master = publicMasters.find(candidate =>
  masterSeoSlug(candidate) === requestedSlug
  && masterSeoPath(candidate) === `/masters/${requestedSlug}`,
)

if (!master) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Barber not found',
  })
}

const canonicalPath = masterSeoPath(master)
const publicCatalog = indexableServiceCatalog(
  (source.value?.catalog || []) as PublicServiceCatalogItemDto[],
)
const catalogByBaseId = new Map(
  publicCatalog.flatMap((service) => {
    const id = serviceStableId(service)
    return id ? [[id, service] as const] : []
  }),
)

const { data: trust } = await useAsyncData<BarberTrust>(
  `barber-profile-trust-${master.id}`,
  async () => {
    const [summary, reviewsResponse] = await Promise.all([
      domain.getMasterRatingSummary(master.id).catch(() => null),
      domain.getMasterReviews(master.id, 6).catch(() => null),
    ])

    return {
      summary,
      reviews: reviewsResponse?.items || [],
    }
  },
  {
    default: () => ({
      summary: null,
      reviews: [],
    }),
  },
)

const fullName = computed(() => masterFullName(master))
const photoUrl = assetUrl(master.photo_url || master.avatar_url || '')

const role = computed(() => {
  if (locale.value === 'en') {
    return master.position_en?.trim()
      || master.title_en?.trim()
      || master.title?.trim()
      || master.position_uk?.trim()
      || master.title_uk?.trim()
      || ''
  }

  return master.position_uk?.trim()
    || master.title_uk?.trim()
    || master.title?.trim()
    || master.position_en?.trim()
    || master.title_en?.trim()
    || ''
})

const profileDescription = computed(() => {
  if (locale.value === 'en') {
    return master.bio_en?.trim()
      || master.description_en?.trim()
      || master.bio?.trim()
      || master.description?.trim()
      || master.bio_uk?.trim()
      || master.description_uk?.trim()
      || ''
  }

  return master.bio_uk?.trim()
    || master.description_uk?.trim()
    || master.bio?.trim()
    || master.description?.trim()
    || master.bio_en?.trim()
    || master.description_en?.trim()
    || ''
})

const services = computed<BarberService[]>(() => {
  const seenServices = new Set<string>()
  const masterServices = (master.services || []) as PublicServiceDto[]

  return masterServices.filter(isPublicServiceActive).flatMap((service) => {
    const baseId = typeof service.base_service_id === 'number'
      ? service.base_service_id
      : null
    const catalogService = baseId ? catalogByBaseId.get(baseId) : undefined
    const serviceKey = catalogService && baseId
      ? `base:${baseId}`
      : `service:${service.id}`

    const name = localizedService.serviceName(service)
      || (catalogService ? localizedService.serviceName(catalogService) : '')

    if (!name || seenServices.has(serviceKey)) return []

    seenServices.add(serviceKey)
    return [{
      id: service.id,
      name,
      path: catalogService ? serviceSeoPath(catalogService) : undefined,
      price: service.active_promotion?.promotional_price ?? service.price,
      durationMinutes: service.duration_minutes,
    }]
  })
})

const serviceGridItems = computed<PublicServiceCatalogItemDto[]>(() => {
  const seenServices = new Set<string>()
  const masterServices = (master.services || []) as PublicServiceDto[]

  return masterServices.filter(isPublicServiceActive).flatMap((service) => {
    const baseId = typeof service.base_service_id === 'number'
      ? service.base_service_id
      : null
    const catalogService = baseId ? catalogByBaseId.get(baseId) : undefined
    const serviceKey = catalogService && baseId
      ? `base:${baseId}`
      : `service:${service.id}`

    if (seenServices.has(serviceKey)) return []
    seenServices.add(serviceKey)

    const serviceName = service.name?.trim() || catalogService?.name || ''
    if (!serviceName) return []

    const titleUk = service.title_uk?.trim() || catalogService?.title_uk || null
    const titleEn = service.title_en?.trim() || catalogService?.title_en || null
    const description = service.description?.trim() || catalogService?.description || null
    const descriptionUk = service.description_uk?.trim() || catalogService?.description_uk || null
    const descriptionEn = service.description_en?.trim() || catalogService?.description_en || null
    const activePromotion = service.active_promotion || null

    return [{
      ...catalogService,
      catalog_id: catalogService?.catalog_id || `master:${master.id}:service:${service.id}`,
      base_service_id: baseId,
      source_type: catalogService?.source_type || (baseId ? 'base' : 'custom'),
      name: serviceName,
      title_uk: titleUk,
      title_en: titleEn,
      description,
      description_uk: descriptionUk,
      description_en: descriptionEn,
      price: service.price,
      duration_minutes: service.duration_minutes,
      active_promotion: activePromotion,
      barber_ids: [master.id],
      barber_service_ids: [service.id],
      barber_services: [{
        id: service.id,
        barber_id: master.id,
        name: serviceName,
        title_uk: titleUk,
        title_en: titleEn,
        description,
        description_uk: descriptionUk,
        description_en: descriptionEn,
        price: service.price,
        duration_minutes: service.duration_minutes,
        is_active: service.is_active,
        active_promotion: activePromotion,
      }],
    }]
  })
})

const approvedReviews = computed<ApprovedReview[]>(() =>
  (trust.value?.reviews || []).flatMap((review) => {
    const comment = review.comment?.trim() || ''
    const authorName = review.author_name?.trim() || ''
    const rating = Number(review.rating)
    const publishedAt = Number.isFinite(Date.parse(review.published_at))
      ? review.published_at
      : ''

    if (!comment || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return []
    }

    return [{
      id: review.id,
      rating,
      comment,
      authorName,
      publishedAt,
    }]
  }),
)

const rating = computed(() => {
  const summary = trust.value?.summary
  const ratingValue = Number(summary?.average_rating)
  const reviewCount = Number(summary?.approved_review_count)

  if (
    !Number.isFinite(ratingValue)
    || ratingValue <= 0
    || ratingValue > 5
    || !Number.isInteger(reviewCount)
    || reviewCount <= 0
  ) {
    return null
  }

  return { ratingValue, reviewCount }
})

const activeReviewIndex = ref(0)
const visibleReviewSlides = ref(1)
const expandedReviewIds = ref<number[]>([])

const maxActiveReviewIndex = computed(() =>
  Math.max(0, approvedReviews.value.length - visibleReviewSlides.value),
)

const reviewSliderTransform = computed(() =>
  `translateX(-${activeReviewIndex.value * (100 / visibleReviewSlides.value)}%)`,
)

const goToReview = (index: number) => {
  if (!approvedReviews.value.length) return
  activeReviewIndex.value = (index + maxActiveReviewIndex.value + 1) % (maxActiveReviewIndex.value + 1)
}

let reviewAutoplayTimer: ReturnType<typeof setInterval> | null = null

const stopReviewAutoplay = () => {
  if (!import.meta.client || !reviewAutoplayTimer) return
  clearInterval(reviewAutoplayTimer)
  reviewAutoplayTimer = null
}

const startReviewAutoplay = () => {
  if (!import.meta.client) return
  stopReviewAutoplay()
  if (maxActiveReviewIndex.value <= 0) return

  reviewAutoplayTimer = setInterval(() => {
    goToReview(activeReviewIndex.value + 1)
  }, 3000)
}

const updateVisibleReviewSlides = () => {
  if (!import.meta.client) return

  if (window.matchMedia('(min-width: 1024px)').matches) {
    visibleReviewSlides.value = 3
    return
  }

  if (window.matchMedia('(min-width: 768px)').matches) {
    visibleReviewSlides.value = 2
    return
  }

  visibleReviewSlides.value = 1
}

const starIcons = (reviewRating: number) =>
  Array.from({ length: 5 }, (_, index) => index < Math.round(reviewRating))

const isReviewExpanded = (review: ApprovedReview) =>
  expandedReviewIds.value.includes(review.id)

const toggleReviewText = (review: ApprovedReview) => {
  if (isReviewExpanded(review)) {
    expandedReviewIds.value = expandedReviewIds.value.filter(id => id !== review.id)
    return
  }

  expandedReviewIds.value = [...expandedReviewIds.value, review.id]
}

const reviewPreview = (review: ApprovedReview) => {
  if (isReviewExpanded(review) || review.comment.length <= 140) return review.comment
  return `${review.comment.slice(0, 140).trimEnd()}...`
}

watch(
  () => approvedReviews.value.length,
  (length) => {
    if (!length) {
      activeReviewIndex.value = 0
      stopReviewAutoplay()
      return
    }

    if (activeReviewIndex.value >= length) activeReviewIndex.value = 0
    if (import.meta.client) startReviewAutoplay()
  },
  { immediate: true },
)

watch(visibleReviewSlides, () => {
  if (activeReviewIndex.value > maxActiveReviewIndex.value) {
    activeReviewIndex.value = maxActiveReviewIndex.value
  }
})

onMounted(() => {
  updateVisibleReviewSlides()
  window.addEventListener('resize', updateVisibleReviewSlides)
  startReviewAutoplay()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateVisibleReviewSlides)
  stopReviewAutoplay()
})

const pageLabels = computed(() => locale.value === 'en'
  ? {
      backHome: 'Home',
      book: 'Book online',
      journal: 'Soul Cuts Journal',
      local: 'Soul Cuts in Odesa',
      masters: 'Barbers',
      metaLead: 'Barber at Soul Cuts in Odesa',
      nextReview: 'Next review',
      previousReview: 'Previous review',
      reviews: 'Approved client reviews',
      reviewCount: 'approved reviews',
      reviewGuest: 'Soul Cuts client',
      seeFullReview: 'Read full review',
      services: 'Available services',
      servicesIntro: 'Current services, prices and duration for this barber.',
      showLessReview: 'Show less',
      viewAllServices: 'View all services',
      viewTeam: 'Meet the team',
    }
  : {
      backHome: 'Головна',
      book: 'Записатися онлайн',
      journal: 'Журнал Soul Cuts',
      local: 'Soul Cuts в Одесі',
      masters: 'Барбери',
      metaLead: 'Барбер Soul Cuts в Одесі',
      nextReview: 'Наступний відгук',
      previousReview: 'Попередній відгук',
      reviews: 'Схвалені відгуки клієнтів',
      reviewCount: 'схвалених відгуків',
      reviewGuest: 'Клієнт Soul Cuts',
      seeFullReview: 'Читати повністю',
      services: 'Доступні послуги',
      servicesIntro: 'Актуальні послуги, ціни та тривалість роботи цього барбера.',
      showLessReview: 'Згорнути',
      viewAllServices: 'Усі послуги',
      viewTeam: 'Переглянути команду',
    })

const pageTitle = computed(() =>
  locale.value === 'en'
    ? `${fullName.value} — Soul Cuts barber in Odesa`
    : `${fullName.value} — барбер Soul Cuts в Одесі`,
)

const pageDescription = computed(() => {
  const serviceNames = services.value.slice(0, 4).map(service => service.name).join(', ')

  return locale.value === 'en'
    ? `${fullName.value}, ${pageLabels.value.metaLead}. Available services: ${serviceNames}. See current prices, duration and online booking.`
    : `${fullName.value} — ${pageLabels.value.metaLead}. Доступні послуги: ${serviceNames}. Актуальні ціни, тривалість та онлайн-запис.`
})

const breadcrumbs = computed(() => [
  {
    name: pageLabels.value.masters,
    path: '/masters',
  },
  {
    name: fullName.value,
    path: canonicalPath,
  },
])

const formatReviewDate = (value: string) => {
  if (!value) return ''

  return new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'uk-UA', {
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(value))
}

useSeo(pageTitle, pageDescription, {
  breadcrumbs,
  image: photoUrl,
  path: canonicalPath,
  type: 'profile',
})

useBarberStructuredData(() => ({
  name: fullName.value,
  description: profileDescription.value || null,
  image: photoUrl,
  jobTitle: role.value || null,
  path: canonicalPath,
  rating: rating.value,
  reviews: approvedReviews.value
    .filter(review => Boolean(review.authorName))
    .map(review => ({
      authorName: review.authorName,
      body: review.comment,
      datePublished: review.publishedAt || null,
      rating: review.rating,
    })),
  services: services.value.map(service => ({
    durationMinutes: service.durationMinutes,
    name: service.name,
    path: service.path,
    price: service.price,
  })),
}))
</script>

<template>
  <div class="bg-stone-100 text-neutral-950">
    <section class="section-y">
      <div class="site-container">
        <nav class="flex flex-wrap items-center gap-2 text-sm text-neutral-500" :aria-label="pageLabels.masters">
          <NuxtLink to="/" class="transition hover:text-neutral-950">
            {{ pageLabels.backHome }}
          </NuxtLink>
          <span aria-hidden="true">/</span>
          <NuxtLink to="/masters" class="transition hover:text-neutral-950">
            {{ pageLabels.masters }}
          </NuxtLink>
          <span aria-hidden="true">/</span>
          <span class="text-neutral-950" aria-current="page">{{ fullName }}</span>
        </nav>

        <div class="mt-8 grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start lg:gap-16">
          <div class="overflow-hidden bg-neutral-950">
            <img
              :src="photoUrl"
              :alt="`${fullName} — Soul Cuts`"
              class="aspect-[4/5] h-full w-full object-cover object-top"
              width="900"
              height="1125"
              loading="eager"
              fetchpriority="high"
            >
          </div>

          <div class="space-y-7">
            <div>
              <p v-if="role" class="type-eyebrow type-eyebrow--wide text-xs text-amber-700">
                {{ role }}
              </p>
              <h1 class="mt-3 max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">
                {{ fullName }}
              </h1>
              <p v-if="profileDescription" class="mt-5 max-w-2xl text-lg leading-8 text-neutral-700">
                {{ profileDescription }}
              </p>
            </div>

            <div v-if="rating" class="flex flex-wrap items-center gap-2 text-sm">
              <span class="font-semibold text-amber-600" :aria-label="`${rating.ratingValue.toFixed(1)} / 5`">
                ★ {{ rating.ratingValue.toFixed(1) }}
              </span>
              <span class="text-neutral-500">
                {{ rating.reviewCount }} {{ pageLabels.reviewCount }}
              </span>
            </div>

            <div>
              <p class="type-eyebrow text-xs text-neutral-500">
                {{ pageLabels.services }}
              </p>
              <ul class="mt-3 flex flex-wrap gap-2">
                <li
                  v-for="service in services"
                  :key="service.id"
                  class="border border-neutral-300 bg-white/60 px-3 py-2 text-sm font-semibold"
                >
                  {{ service.name }}
                </li>
              </ul>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row">
              <BaseButton to="/#booking">
                {{ pageLabels.book }}
              </BaseButton>
              <BaseButton to="/masters" variant="light">
                {{ pageLabels.viewTeam }}
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </section>

    <ServicesGrid
      :services="serviceGridItems"
      :section-label="pageLabels.services"
      :section-title="pageLabels.services"
      :section-description="pageLabels.servicesIntro"
      show-catalogue-link
      preserve-catalog-items
      :price-from="false"
    />

    <section id="reviews" v-if="approvedReviews.length" class="section-y-tight bg-stone-100">
      <div class="site-container">
        <div class="flex flex-col justify-between gap-4 md:flex-row md:items-end md:gap-6" data-reveal="soft">
          <div>
            <SectionLabel>{{ pageLabels.reviews }}</SectionLabel>
            <p v-if="rating" class="mt-4 text-3xl font-semibold leading-tight text-neutral-950">
              {{ rating.ratingValue.toFixed(1) }}/5
            </p>
          </div>
          <p v-if="rating" class="type-eyebrow text-xs text-neutral-600">
            {{ rating.reviewCount }} {{ pageLabels.reviewCount }}
          </p>
        </div>

        <div class="mt-8 md:mt-10">
          <div
            class="overflow-hidden"
            @mouseenter="stopReviewAutoplay"
            @mouseleave="startReviewAutoplay"
            @focusin="stopReviewAutoplay"
            @focusout="startReviewAutoplay"
          >
            <div
              class="flex transition-transform duration-700 ease-out"
              :style="{ transform: reviewSliderTransform }"
            >
              <article
                v-for="(review, index) in approvedReviews"
                :key="review.id"
                class="min-w-full border-l border-neutral-300 pl-4 pr-4 md:min-w-[50%] md:pl-5 md:pr-6 lg:min-w-[33.333333%]"
                data-reveal="soft"
                :data-reveal-delay="Math.min(index, 2) * 90"
              >
                <div class="mb-4">
                  <p class="text-sm font-semibold text-neutral-950">
                    {{ review.authorName || pageLabels.reviewGuest }}
                  </p>
                  <div class="type-meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600">
                    <span class="flex items-center gap-0.5 text-amber-500" role="img" :aria-label="`${review.rating}/5`">
                      <span
                        v-for="(filled, starIndex) in starIcons(review.rating)"
                        :key="starIndex"
                        :class="filled ? 'text-amber-500' : 'text-neutral-300'"
                        aria-hidden="true"
                      >★</span>
                    </span>
                    <span v-if="formatReviewDate(review.publishedAt)">/ {{ formatReviewDate(review.publishedAt) }}</span>
                  </div>
                </div>
                <p class="text-sm font-semibold leading-6 text-neutral-950 md:text-base md:leading-7">
                  "{{ reviewPreview(review) }}"
                </p>
                <button
                  v-if="review.comment.length > 140"
                  type="button"
                  class="type-meta mt-4 text-xs text-neutral-600 transition hover:text-neutral-950"
                  @click="toggleReviewText(review)"
                >
                  <BaseHoverUnderlineText>
                    {{ isReviewExpanded(review) ? pageLabels.showLessReview : pageLabels.seeFullReview }}
                  </BaseHoverUnderlineText>
                </button>
              </article>
            </div>
          </div>

          <div class="mt-7 flex justify-end">
            <div class="flex gap-2">
              <BaseButton
                type="button"
                variant="outline-dark"
                shape="circle"
                size="sm"
                :aria-label="pageLabels.previousReview"
                @click="goToReview(activeReviewIndex - 1)"
              >
                ‹
              </BaseButton>
              <BaseButton
                type="button"
                variant="outline-dark"
                shape="circle"
                size="sm"
                :aria-label="pageLabels.nextReview"
                @click="goToReview(activeReviewIndex + 1)"
              >
                ›
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section-y-tight bg-neutral-950 text-white">
      <div class="site-container flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <SectionLabel class="text-white/60">Soul Cuts / Odesa</SectionLabel>
          <h2 class="section-title-inverse mt-4 max-w-2xl">
            {{ fullName }}
          </h2>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row">
          <BaseButton to="/#booking" variant="light">
            {{ pageLabels.book }}
          </BaseButton>
          <BaseButton to="/barbershop-odesa" variant="outline-light">
            {{ pageLabels.local }}
          </BaseButton>
          <BaseButton href="/blog/" variant="outline-light">
            {{ pageLabels.journal }}
          </BaseButton>
        </div>
      </div>
    </section>
  </div>
</template>

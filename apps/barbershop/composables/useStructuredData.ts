import { toValue, type MaybeRefOrGetter } from 'vue'
import defaultBusinessImage from '~/assets/images/main/sc-open-img.webp'

type JsonLdValue = Record<string, unknown> | Record<string, unknown>[]

type ServiceStructuredDataItem = {
  name: string
  description?: string | null
  price?: string | number | null
  durationMinutes?: number | null
}

type ReviewsStructuredDataValue = {
  averageRating?: number | null
  reviewCount?: number | null
  reviews?: readonly {
    authorName?: string | null
    rating?: number | null
    body?: string | null
    datePublished?: string | null
  }[]
}

const escapeJsonLd = (value: JsonLdValue) =>
  JSON.stringify(value).replace(/</g, '\\u003c')

export const useJsonLd = (key: string, value: MaybeRefOrGetter<JsonLdValue>) => {
  useHead({
    script: [
      {
        key,
        type: 'application/ld+json',
        innerHTML: () => escapeJsonLd(toValue(value)),
      },
    ],
  })
}

export const useLocalBusinessStructuredData = () => {
  const { terms } = useTerms()
  const { absoluteUrl, siteUrl } = useSiteUrl()

  useJsonLd('local-business-schema', () => ({
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    '@id': `${siteUrl}/#local-business`,
    name: terms.value.common.brand,
    alternateName: [
      'Soulcuts',
      'Soul Cuts Barbershop',
      'Soul Cuts Odesa',
      'Barbershop Odesa',
      'Barbershop Odessa',
      'Барбершоп Одеса',
      'Барбершоп Одесса',
    ],
    url: siteUrl,
    image: absoluteUrl(defaultBusinessImage),
    logo: absoluteUrl(defaultBusinessImage),
    description: terms.value.seo.homeDescription,
    telephone: terms.value.home.contact.phone,
    email: terms.value.home.contact.email,
    priceRange: '₴₴',
    currenciesAccepted: 'UAH',
    paymentAccepted: 'Cash, Card',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'вулиця Канатна, 6',
      addressLocality: 'Одеса',
      addressRegion: 'Одеська область',
      addressCountry: 'UA',
    },
    areaServed: [
      {
        '@type': 'City',
        name: 'Одеса',
        sameAs: 'https://www.wikidata.org/wiki/Q1874',
      },
      {
        '@type': 'AdministrativeArea',
        name: 'Одеська область',
      },
    ],
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '09:00',
        closes: '20:00',
      },
    ],
    hasMap: terms.value.home.contact.mapUrl,
    sameAs: [
      'https://t.me/SoulcutsBot',
      'https://www.youtube.com/@idemnabukvy/featured',
      terms.value.home.contact.mapUrl,
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: terms.value.home.contact.phone,
      email: terms.value.home.contact.email,
      contactType: 'booking',
      areaServed: 'UA',
      availableLanguage: ['uk', 'en'],
    },
    makesOffer: {
      '@type': 'OfferCatalog',
      name: terms.value.seo.servicesTitle,
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Чоловіча стрижка',
            serviceType: 'Men haircut',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Оформлення бороди',
            serviceType: 'Beard trim',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Гоління шаветкою',
            serviceType: 'Shaving',
          },
        },
      ],
    },
    potentialAction: {
      '@type': 'ReserveAction',
      target: absoluteUrl('/#booking'),
      name: terms.value.common.bookAppointment,
    },
  }))

  useJsonLd('website-schema', () => ({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: terms.value.common.brand,
    url: siteUrl,
    inLanguage: ['uk-UA', 'en-US'],
    publisher: {
      '@id': `${siteUrl}/#local-business`,
    },
  }))
}

export const useServiceCatalogStructuredData = (
  items: MaybeRefOrGetter<readonly ServiceStructuredDataItem[]>,
) => {
  const { absoluteUrl, siteUrl } = useSiteUrl()
  const { terms } = useTerms()

  useJsonLd('service-catalog-schema', () => ({
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    '@id': `${absoluteUrl('/services')}#service-catalog`,
    name: terms.value.seo.servicesTitle,
    url: absoluteUrl('/services'),
    provider: {
      '@id': `${siteUrl}/#local-business`,
    },
    itemListElement: toValue(items).map((item, index) => ({
      '@type': 'Offer',
      position: index + 1,
      priceCurrency: 'UAH',
      price: item.price == null ? undefined : String(item.price),
      availability: 'https://schema.org/InStock',
      itemOffered: {
        '@type': 'Service',
        name: item.name,
        description: item.description || undefined,
        provider: {
          '@id': `${siteUrl}/#local-business`,
        },
        areaServed: {
          '@type': 'City',
          name: 'Одеса',
        },
        serviceType: item.name,
        duration: item.durationMinutes ? `PT${item.durationMinutes}M` : undefined,
      },
    })),
  }))
}

export const useReviewsStructuredData = (
  value: MaybeRefOrGetter<ReviewsStructuredDataValue>,
) => {
  const { siteUrl } = useSiteUrl()

  useJsonLd('reviews-schema', () => {
    const reviewsValue = toValue(value)
    const graph: Record<string, unknown>[] = []

    if (reviewsValue.averageRating && reviewsValue.reviewCount) {
      graph.push({
        '@type': 'AggregateRating',
        itemReviewed: {
          '@id': `${siteUrl}/#local-business`,
        },
        ratingValue: reviewsValue.averageRating,
        bestRating: 5,
        worstRating: 1,
        reviewCount: reviewsValue.reviewCount,
      })
    }

    graph.push(...(reviewsValue.reviews || [])
      .filter(review => review.body && review.rating)
      .slice(0, 10)
      .map(review => ({
        '@type': 'Review',
        itemReviewed: {
          '@id': `${siteUrl}/#local-business`,
        },
        author: {
          '@type': 'Person',
          name: review.authorName || 'Google reviewer',
        },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: review.rating,
          bestRating: 5,
          worstRating: 1,
        },
        reviewBody: review.body,
        datePublished: review.datePublished || undefined,
      })))

    return {
      '@context': 'https://schema.org',
      '@graph': graph,
    }
  })
}

export const useWebPageStructuredData = (
  title: MaybeRefOrGetter<string>,
  description: MaybeRefOrGetter<string>,
  path?: MaybeRefOrGetter<string>,
) => {
  const route = useRoute()
  const { absoluteUrl, siteUrl } = useSiteUrl()
  const { locale } = useTerms()

  useJsonLd('web-page-schema', () => {
    const pagePath = toValue(path) || route.path
    const url = absoluteUrl(pagePath)

    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: toValue(title),
      description: toValue(description),
      inLanguage: locale.value === 'uk' ? 'uk-UA' : 'en-US',
      isPartOf: {
        '@id': `${siteUrl}/#website`,
      },
      about: {
        '@id': `${siteUrl}/#local-business`,
      },
    }
  })
}

export const useBreadcrumbStructuredData = (
  title: MaybeRefOrGetter<string>,
  path?: MaybeRefOrGetter<string>,
) => {
  const route = useRoute()
  const { absoluteUrl } = useSiteUrl()
  const { terms } = useTerms()

  useJsonLd('breadcrumb-schema', () => {
    const pagePath = toValue(path) || route.path
    const items: Record<string, unknown>[] = [
      {
        '@type': 'ListItem',
        position: 1,
        name: terms.value.common.brand,
        item: absoluteUrl('/'),
      },
    ]

    if (pagePath !== '/') {
      items.push({
        '@type': 'ListItem',
        position: 2,
        name: toValue(title),
        item: absoluteUrl(pagePath),
      })
    }

    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items,
    }
  })
}

export const useFaqStructuredData = (
  items: MaybeRefOrGetter<readonly { question: string, answer: string }[]>,
) => {
  useJsonLd('faq-schema', () => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: toValue(items).map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }))
}

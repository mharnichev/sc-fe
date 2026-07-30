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

type ServiceDetailStructuredDataValue = {
  description: string
  durationMinutes?: number | null
  name: string
  offers: readonly {
    durationMinutes?: number | null
    name?: string | null
    price?: string | number | null
  }[]
  path: string
}

type BarberStructuredDataValue = {
  description?: string | null
  image?: string | null
  jobTitle?: string | null
  name: string
  path: string
  rating?: {
    ratingValue?: number | null
    reviewCount?: number | null
  } | null
  reviews?: readonly {
    authorName: string
    body?: string | null
    datePublished?: string | null
    rating: number
  }[]
  services: readonly {
    durationMinutes?: number | null
    name: string
    path?: string | null
    price?: string | number | null
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
    url: siteUrl,
    image: absoluteUrl(defaultBusinessImage),
    logo: absoluteUrl(defaultBusinessImage),
    description: terms.value.seo.homeDescription,
    telephone: terms.value.home.contact.phone,
    currenciesAccepted: 'UAH',
    address: {
      '@type': 'PostalAddress',
      streetAddress: terms.value.home.contact.address.replace(/^\s*📍\s*/, '').trim(),
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
      contactType: 'booking',
      areaServed: 'UA',
      availableLanguage: ['uk', 'en'],
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

export const useServiceStructuredData = (
  value: MaybeRefOrGetter<ServiceDetailStructuredDataValue>,
) => {
  const { absoluteUrl, siteUrl } = useSiteUrl()

  useJsonLd('service-detail-schema', () => {
    const service = toValue(value)
    const url = absoluteUrl(service.path)

    return {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${url}#service`,
      name: service.name,
      description: service.description,
      url,
      duration: service.durationMinutes ? `PT${service.durationMinutes}M` : undefined,
      provider: {
        '@id': `${siteUrl}/#local-business`,
      },
      areaServed: {
        '@type': 'City',
        name: 'Одеса',
      },
      offers: service.offers
        .filter(offer => offer.price !== null && offer.price !== undefined && offer.price !== '')
        .map(offer => ({
          '@type': 'Offer',
          name: offer.name || service.name,
          url,
          price: String(offer.price),
          priceCurrency: 'UAH',
          availability: 'https://schema.org/InStock',
          seller: {
            '@id': `${siteUrl}/#local-business`,
          },
          itemOffered: {
            '@type': 'Service',
            name: offer.name || service.name,
            duration: offer.durationMinutes ? `PT${offer.durationMinutes}M` : undefined,
            provider: {
              '@id': `${siteUrl}/#local-business`,
            },
          },
        })),
      potentialAction: {
        '@type': 'ReserveAction',
        name: service.name,
        target: absoluteUrl('/#booking'),
      },
    }
  })
}

export const useBarberStructuredData = (
  value: MaybeRefOrGetter<BarberStructuredDataValue>,
) => {
  const { absoluteUrl, siteUrl } = useSiteUrl()

  useJsonLd('barber-profile-schema', () => {
    const barber = toValue(value)
    const url = absoluteUrl(barber.path)
    const ratingValue = barber.rating?.ratingValue
    const reviewCount = barber.rating?.reviewCount
    const hasRating = typeof ratingValue === 'number'
      && ratingValue > 0
      && typeof reviewCount === 'number'
      && reviewCount > 0

    return {
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': `${url}#barber`,
      name: barber.name,
      description: barber.description || undefined,
      image: barber.image ? absoluteUrl(barber.image) : undefined,
      url,
      jobTitle: barber.jobTitle || undefined,
      worksFor: {
        '@id': `${siteUrl}/#local-business`,
      },
      makesOffer: barber.services
        .filter(service => service.price !== null && service.price !== undefined && service.price !== '')
        .map(service => ({
          '@type': 'Offer',
          name: service.name,
          url: service.path ? absoluteUrl(service.path) : url,
          price: String(service.price),
          priceCurrency: 'UAH',
          availability: 'https://schema.org/InStock',
          itemOffered: {
            '@type': 'Service',
            name: service.name,
            duration: service.durationMinutes ? `PT${service.durationMinutes}M` : undefined,
            provider: {
              '@id': `${siteUrl}/#local-business`,
            },
          },
        })),
      aggregateRating: hasRating
        ? {
            '@type': 'AggregateRating',
            ratingValue,
            reviewCount,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
      review: (barber.reviews || [])
        .filter(review => review.body && review.rating > 0)
        .map(review => ({
          '@type': 'Review',
          author: {
            '@type': 'Person',
            name: review.authorName,
          },
          reviewRating: {
            '@type': 'Rating',
            ratingValue: review.rating,
            bestRating: 5,
            worstRating: 1,
          },
          reviewBody: review.body,
          datePublished: review.datePublished || undefined,
        })),
      potentialAction: {
        '@type': 'ReserveAction',
        name: barber.name,
        target: absoluteUrl('/#booking'),
      },
    }
  })
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
  breadcrumbs?: MaybeRefOrGetter<readonly { name: string, path: string }[]>,
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

    const customBreadcrumbs = breadcrumbs ? toValue(breadcrumbs) : []

    if (customBreadcrumbs.length) {
      items.push(...customBreadcrumbs.map((breadcrumb, index) => ({
        '@type': 'ListItem',
        position: index + 2,
        name: breadcrumb.name,
        item: absoluteUrl(breadcrumb.path),
      })))
    }
    else if (pagePath !== '/') {
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

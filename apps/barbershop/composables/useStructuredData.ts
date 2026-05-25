import { toValue, type MaybeRefOrGetter } from 'vue'
import defaultBusinessImage from '~/assets/images/main/sc-open-img.webp'

type JsonLdValue = Record<string, unknown> | Record<string, unknown>[]

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
    email: terms.value.home.contact.email,
    priceRange: '₴₴',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'вулиця Канатна, 6',
      addressLocality: 'Одеса',
      addressCountry: 'UA',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '09:00',
        closes: '20:00',
      },
    ],
    sameAs: [
      'https://t.me/SoulcutsBot',
      'https://www.youtube.com/@idemnabukvy/featured',
      terms.value.home.contact.mapUrl,
    ],
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

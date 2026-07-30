import { toValue, type MaybeRefOrGetter } from 'vue'
import defaultOgImage from '~/assets/images/main/sc-open-img.webp'

interface SeoOptions {
  breadcrumbs?: MaybeRefOrGetter<readonly { name: string, path: string }[]>
  image?: MaybeRefOrGetter<string>
  path?: MaybeRefOrGetter<string>
  type?: MaybeRefOrGetter<'website' | 'article' | 'profile'>
}

const normalizeRoutePath = (path: string) => {
  const cleanPath = path.split('#')[0]?.split('?')[0] || '/'
  const withLeadingSlash = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`
  return withLeadingSlash === '/' ? withLeadingSlash : withLeadingSlash.replace(/\/+$/, '')
}

export const useSeo = (
  title: MaybeRefOrGetter<string>,
  description: MaybeRefOrGetter<string>,
  options: SeoOptions = {},
) => {
  const route = useRoute()
  const { absoluteUrl } = useSiteUrl()
  const { locale, terms } = useTerms()

  const pagePath = () => normalizeRoutePath(toValue(options.path) || route.path)
  const pageUrl = () => absoluteUrl(pagePath())
  const imageUrl = () => absoluteUrl(toValue(options.image) || defaultOgImage)

  useSeoMeta({
    title: () => toValue(title),
    description: () => toValue(description),
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    author: () => terms.value.common.brand,
    ogTitle: () => toValue(title),
    ogDescription: () => toValue(description),
    ogSiteName: () => terms.value.common.brand,
    ogType: () => toValue(options.type) || 'website',
    ogUrl: pageUrl,
    ogImage: imageUrl,
    ogImageAlt: () => toValue(title),
    ogLocale: () => locale.value === 'uk' ? 'uk_UA' : 'en_US',
    twitterCard: 'summary_large_image',
    twitterTitle: () => toValue(title),
    twitterDescription: () => toValue(description),
    twitterImage: imageUrl,
  })

  useHead({
    link: [
      {
        rel: 'canonical',
        href: pageUrl,
      },
    ],
  })

  if (import.meta.server) {
    useWebPageStructuredData(title, description, pagePath)
    useBreadcrumbStructuredData(title, pagePath, options.breadcrumbs)
  }
}

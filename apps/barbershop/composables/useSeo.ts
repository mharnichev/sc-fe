import { toValue, type MaybeRefOrGetter } from 'vue'
import defaultOgImage from '~/assets/images/main/sc-open-img.webp'

interface SeoOptions {
  image?: MaybeRefOrGetter<string>
  path?: MaybeRefOrGetter<string>
  type?: MaybeRefOrGetter<'website' | 'article'>
}

const normalizeRoutePath = (path: string) => path.split('#')[0]?.split('?')[0] || '/'

export const useSeo = (
  title: MaybeRefOrGetter<string>,
  description: MaybeRefOrGetter<string>,
  options: SeoOptions = {},
) => {
  const route = useRoute()
  const { absoluteUrl } = useSiteUrl()
  const { locale } = useTerms()

  const pagePath = () => toValue(options.path) || normalizeRoutePath(route.path)
  const pageUrl = () => absoluteUrl(pagePath())
  const imageUrl = () => absoluteUrl(toValue(options.image) || defaultOgImage)

  useSeoMeta({
    title: () => toValue(title),
    description: () => toValue(description),
    ogTitle: () => toValue(title),
    ogDescription: () => toValue(description),
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

  useWebPageStructuredData(title, description, pagePath)
  useBreadcrumbStructuredData(title, pagePath)
}

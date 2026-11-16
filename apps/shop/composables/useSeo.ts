import type { MaybeRefOrGetter } from 'vue'
import { shopIndexableUrl } from '~/utils/shopSeo'

export const useSeo = (
  title: MaybeRefOrGetter<string>,
  description: MaybeRefOrGetter<string>,
  extras: Parameters<typeof useSeoMeta>[0] = {},
  indexable: () => boolean = () => true,
) => {
  const route = useRoute()
  const config = useRuntimeConfig()
  const canonical = computed(() => {
    if (!indexable()) return null
    const url = new URL(route.fullPath, config.public.siteUrl)
    return shopIndexableUrl(config.public.siteUrl, config.app.baseURL, route.path, url.searchParams)
  })

  useHead(() => ({
    link: canonical.value ? [{ rel: 'canonical', href: canonical.value }] : [],
  }))
  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogUrl: () => canonical.value ?? undefined,
    robots: () => canonical.value ? undefined : 'noindex, nofollow',
    ...extras,
  })
}

import type { MaybeRefOrGetter } from 'vue'

export const useSeo = (
  title: MaybeRefOrGetter<string>,
  description: MaybeRefOrGetter<string>,
  extras: Record<string, unknown> = {},
) => {
  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ...extras,
    robots: 'noindex, nofollow, noarchive',
  })
}

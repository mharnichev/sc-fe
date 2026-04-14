export const useSeo = (title: string, description: string, extras: Record<string, unknown> = {}) => {
  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ...extras,
  })
}

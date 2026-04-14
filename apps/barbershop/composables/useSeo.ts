export const useSeo = (title: string, description: string) => {
  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogType: 'website',
  })
}

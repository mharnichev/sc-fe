import artwork from '~/data/category-artwork.json'

// Slugs are unique across the category tree; translated display names are not.
const bySlug = new Map(artwork.map(item => [item.slug, item]))

export const categoryArtwork = (slug: string) => {
  const item = bySlug.get(slug)
  if (!item) return null
  return {
    ...item,
    src: `/category-cartoons/${item.file}`,
  }
}

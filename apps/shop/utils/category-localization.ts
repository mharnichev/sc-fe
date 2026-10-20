export interface LocalizedCategory {
  name: string
  name_en?: string | null
}

export const localizedCategoryName = (category: LocalizedCategory, locale: string): string =>
  locale === 'en' && category.name_en?.trim() ? category.name_en : category.name

import { localizedCategoryName, localizedCategoryDescription } from '~/utils/category-localization'

export const useCategoryDisplay = () => {
  const { locale } = useShopLocale()
  return {
    categoryDisplayDescription: (category: Parameters<typeof localizedCategoryDescription>[0]) => localizedCategoryDescription(category, locale.value),
    categoryDisplayName: (category: Parameters<typeof localizedCategoryName>[0]) => localizedCategoryName(category, locale.value),
  }
}

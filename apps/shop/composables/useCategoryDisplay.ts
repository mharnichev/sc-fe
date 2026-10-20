import { localizedCategoryName } from '~/utils/category-localization'

export const useCategoryDisplay = () => {
  const { locale } = useShopLocale()
  return {
    categoryDisplayName: (category: Parameters<typeof localizedCategoryName>[0]) => localizedCategoryName(category, locale.value),
  }
}

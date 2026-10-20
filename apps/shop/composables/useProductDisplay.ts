import { localizedProductName, localizedProductType } from '~/utils/product-localization'

export const useProductDisplay = () => {
  const { locale } = useShopLocale()
  return {
    productDisplayName: (product: Parameters<typeof localizedProductName>[0]) => localizedProductName(product, locale.value),
    productDisplayType: (product: Parameters<typeof localizedProductType>[0]) => localizedProductType(product, locale.value),
  }
}

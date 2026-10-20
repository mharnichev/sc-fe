import { localizedProductName, localizedProductType, localizedProductContent } from '~/utils/product-localization'

export const useProductDisplay = () => {
  const { locale } = useShopLocale()
  return {
    productDisplayContent: (product: Parameters<typeof localizedProductContent>[0], field: Parameters<typeof localizedProductContent>[1]) => localizedProductContent(product, field, locale.value),
    productDisplayName: (product: Parameters<typeof localizedProductName>[0]) => localizedProductName(product, locale.value),
    productDisplayType: (product: Parameters<typeof localizedProductType>[0]) => localizedProductType(product, locale.value),
  }
}

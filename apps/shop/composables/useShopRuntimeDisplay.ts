import { localizedOrderItemName, localizedShopMessage, shopRuntimeCopy } from '~/utils/shop-runtime-localization'

export const useShopRuntimeDisplay = () => {
  const { locale } = useShopLocale()
  return {
    runtimeText: computed(() => shopRuntimeCopy[locale.value === 'en' ? 'en' : 'uk']),
    runtimeMessage: (message: string) => localizedShopMessage(message, locale.value),
    orderItemName: (item: Parameters<typeof localizedOrderItemName>[0]) => localizedOrderItemName(item, locale.value),
  }
}

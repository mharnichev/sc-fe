import { paymentCopy } from '~/utils/payment-localization'

export const usePaymentDisplay = () => {
  const { locale } = useShopLocale()
  return { paymentText: computed(() => paymentCopy[locale.value === 'en' ? 'en' : 'uk']) }
}

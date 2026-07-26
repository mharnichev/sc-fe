interface ShopPriceFormatOptions {
  currency?: boolean
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export const useShopPriceFormatter = () => {
  const { dateLocale, terms } = useShopLocale()

  const formatPrice = (
    value: string | number | null | undefined,
    options: ShopPriceFormatOptions = {},
  ) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return ''

    const minimumFractionDigits = options.minimumFractionDigits ?? 2
    const maximumFractionDigits = options.maximumFractionDigits ?? 2
    const amount = new Intl.NumberFormat(dateLocale.value, {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(numeric)

    return options.currency === false
      ? amount
      : `${amount} ${terms.value.catalog.currencyShort}`
  }

  return {
    formatPrice,
  }
}

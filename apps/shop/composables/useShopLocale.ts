import { shopLocaleOptions, shopTerms, type ShopLocaleCode } from '~/data/locale'

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const isSecureCookieContext = () => {
  if (import.meta.client) {
    return window.location.protocol === 'https:'
  }

  return useRequestURL().protocol === 'https:'
}

const useShopCookieOptions = (options = {}) => ({
  path: '/',
  sameSite: 'lax' as const,
  secure: isSecureCookieContext(),
  ...options,
})

export const useShopLocale = () => {
  const locale = useCookie<ShopLocaleCode>('shop-locale', useShopCookieOptions({
    default: () => 'uk',
    maxAge: LOCALE_COOKIE_MAX_AGE,
  }))

  const setLocale = (nextLocale: ShopLocaleCode) => {
    locale.value = nextLocale
  }

  const terms = computed(() => shopTerms[locale.value] || shopTerms.uk)
  const dateLocale = computed(() => locale.value === 'uk' ? 'uk-UA' : 'en-US')

  return {
    locale,
    localeOptions: shopLocaleOptions,
    setLocale,
    terms,
    dateLocale,
  }
}

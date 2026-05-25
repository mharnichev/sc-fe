import { localeOptions, termsDictionary, type LocaleCode } from '~/data/terms'

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const useTerms = () => {
  const locale = useCookie<LocaleCode>('barbershop-locale', useBarbershopCookieOptions({
    default: () => 'uk',
    maxAge: LOCALE_COOKIE_MAX_AGE,
  }))

  const setLocale = (nextLocale: LocaleCode) => {
    locale.value = nextLocale
  }

  const terms = computed(() => termsDictionary[locale.value] || termsDictionary.uk)

  return {
    locale,
    localeOptions,
    setLocale,
    terms,
  }
}

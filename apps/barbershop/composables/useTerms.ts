import { localeOptions, termsDictionary, type LocaleCode } from '~/data/terms'

export const useTerms = () => {
  const locale = useCookie<LocaleCode>('barbershop-locale', {
    default: () => 'uk',
    sameSite: 'lax',
  })

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

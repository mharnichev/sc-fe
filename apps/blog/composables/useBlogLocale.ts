import { blogTerms, localeOptions, type LocaleCode } from '~/data/locale'

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const isSecureCookieContext = () => {
  if (import.meta.client) {
    return window.location.protocol === 'https:'
  }

  return useRequestURL().protocol === 'https:'
}

const useBlogCookieOptions = (options = {}) => ({
  path: '/',
  sameSite: 'lax' as const,
  secure: isSecureCookieContext(),
  ...options,
})

export const useBlogLocale = () => {
  const locale = useCookie<LocaleCode>('blog-locale', useBlogCookieOptions({
    default: () => 'uk',
    maxAge: LOCALE_COOKIE_MAX_AGE,
  }))

  const setLocale = (nextLocale: LocaleCode) => {
    locale.value = nextLocale
  }

  const terms = computed(() => blogTerms[locale.value] || blogTerms.en)

  return {
    locale,
    localeOptions,
    setLocale,
    terms,
  }
}

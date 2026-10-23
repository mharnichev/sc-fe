import { isTokenizedReviewLocation } from '~/utils/reviews.js'
import { localeOptions, termsDictionary, type LocaleCode } from '~/data/terms'
import { isPublicLocalizedPage, localizedPublicPath, publicRouteLocale } from '~/utils/localeRoutes'

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const useTerms = () => {
  const route = useRoute()
  const preference = useCookie<LocaleCode>('barbershop-locale', useBarbershopCookieOptions({
    default: () => 'uk',
    maxAge: LOCALE_COOKIE_MAX_AGE,
  }))
  const locale = computed<LocaleCode>(() => isPublicLocalizedPage(route.path)
    ? publicRouteLocale(route.path)
    : preference.value === 'en' ? 'en' : 'uk')

  const localePath = (path: string, nextLocale: LocaleCode = locale.value) => {
    const [pathname, hash = ''] = path.split('#')
    const safePath = isTokenizedReviewLocation(pathname?.split('?')[0], `#${hash}`) ? pathname || '/' : path
    return localizedPublicPath(safePath, nextLocale)
  }
  const setLocale = async (nextLocale: LocaleCode) => {
    preference.value = nextLocale
    if (isPublicLocalizedPage(route.path)) {
      await navigateTo(localePath(route.fullPath, nextLocale))
    }
  }

  const terms = computed(() => termsDictionary[locale.value])
  return { locale, localeOptions, localePath, setLocale, terms }
}

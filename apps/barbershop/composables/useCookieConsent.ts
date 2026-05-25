export type CookieConsentChoice = 'all' | 'necessary'

export type CookieConsentState = {
  version: number
  choice: CookieConsentChoice
  analytics: boolean
  marketing: boolean
  createdAt: string
}

const COOKIE_CONSENT_VERSION = 1
const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 180

export const useCookieConsent = () => {
  const consent = useCookie<CookieConsentState | null>('barbershop-cookie-consent', useBarbershopCookieOptions({
    default: () => null,
    maxAge: COOKIE_CONSENT_MAX_AGE,
  }))

  const hasConsent = computed(() => consent.value?.version === COOKIE_CONSENT_VERSION)
  const canUseAnalytics = computed(() => Boolean(hasConsent.value && consent.value?.analytics))
  const canUseMarketing = computed(() => Boolean(hasConsent.value && consent.value?.marketing))

  const setConsent = (choice: CookieConsentChoice) => {
    const optionalCookiesAllowed = choice === 'all'

    consent.value = {
      version: COOKIE_CONSENT_VERSION,
      choice,
      analytics: optionalCookiesAllowed,
      marketing: optionalCookiesAllowed,
      createdAt: new Date().toISOString(),
    }
  }

  const acceptAllCookies = () => setConsent('all')
  const acceptNecessaryCookies = () => setConsent('necessary')

  const resetCookieConsent = () => {
    consent.value = null
  }

  return {
    consent,
    hasConsent,
    canUseAnalytics,
    canUseMarketing,
    acceptAllCookies,
    acceptNecessaryCookies,
    resetCookieConsent,
  }
}

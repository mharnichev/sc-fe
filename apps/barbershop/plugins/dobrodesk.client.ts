import { barbershopSupportAppearance, createDobrodeskLifecycle, isDobrodeskEnabled, isDobrodeskPublicRoute } from '~/utils/dobrodesk'

export default defineNuxtPlugin((nuxtApp) => {
  // The SDK caps its offset at 128px; the booking controls occupy 184px.
  useHead({ style: [{ key: 'dobrodesk-position', textContent: `
    #dobrodesk-support-sandbox {
      position: fixed;
      z-index: 80;
      width: min(380px, calc(100vw - 32px));
      height: min(640px, calc(100dvh - 216px));
      border: 0;
      bottom: 200px !important;
      right: 44px !important;
      max-height: calc(100dvh - 216px) !important;
    }
    @media (max-width: 639px) {
      #dobrodesk-support-sandbox { bottom: 192px !important; right: 16px !important; height: min(640px, calc(100dvh - 208px)); }
    }
    @media (max-height: 600px) {
      #dobrodesk-support-sandbox { bottom: 16px !important; right: 16px !important; height: calc(100dvh - 32px); max-height: calc(100dvh - 32px) !important; }
    }
  ` }] })
  const config = useRuntimeConfig()
  const router = useRouter()
  const { locale } = useTerms()
  const { isPrivateReviewRoute } = useReviewPrivacy()
  const { isOpen } = useFloatingBookingDrawer()
  const lifecycle = createDobrodeskLifecycle({
    integrationId: config.public.dobrodeskIntegrationId,
    enabled: isDobrodeskEnabled(config.public.dobrodeskEnabled),
    customLauncher: true,
    appearance: barbershopSupportAppearance,
    load: async () => {
      const { createSandboxedDobroDeskWidget } = await import('~/utils/dobrodeskSandbox')
      return { createDobroDeskWidget: (options) => createSandboxedDobroDeskWidget(options, config.public.dobrodeskFrameUrl) }
    },
  })
  const supportOpenRequest = useState('dobrodesk-open-request', () => 0)
  const stopOpenRequest = watch(supportOpenRequest, () => lifecycle.open())
  const update = () => lifecycle.update({
    allowed: isDobrodeskPublicRoute(router.currentRoute.value, config.app.baseURL) && !isPrivateReviewRoute.value,
    visible: !isOpen.value,
    locale: locale.value,
  })
  // Hide before navigation commits; never initialize on private/query/hash routes.
  const removeGuard = router.beforeEach(() => {
    lifecycle.update({ allowed: false, visible: false, locale: locale.value })
  })
  const removeAfter = router.afterEach(update)
  const stop = watch(() => [router.currentRoute.value.fullPath, locale.value, isOpen.value, isPrivateReviewRoute.value], update, { immediate: true, flush: 'sync' })
  // Load only when the visitor explicitly opens support, never on general input.
  if (import.meta.hot) import.meta.hot.dispose(() => {
    stopOpenRequest(); stop(); removeGuard(); removeAfter(); lifecycle.dispose()
  })
})

import { barbershopSupportAppearance, createDobrodeskLifecycle, isDobrodeskEnabled, isDobrodeskPublicRoute } from '~/utils/dobrodesk'

export default defineNuxtPlugin(() => {
  // The SDK caps its offset at 128px; the booking controls occupy 184px.
  useHead({ style: [{ key: 'dobrodesk-position', textContent: `
    #dobrodesk-support-sandbox:not(.support-chat-frame iframe) {
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
      #dobrodesk-support-sandbox:not(.support-chat-frame iframe) { bottom: 192px !important; right: 16px !important; height: min(640px, calc(100dvh - 208px)); }
    }
    @media (max-height: 600px) {
      #dobrodesk-support-sandbox:not(.support-chat-frame iframe) { bottom: 16px !important; right: 16px !important; height: calc(100dvh - 32px); max-height: calc(100dvh - 32px) !important; }
    }
  ` }] })
  const config = useRuntimeConfig()
  const router = useRouter()
  const { locale } = useTerms()
  const { isPrivateReviewRoute } = useReviewPrivacy()
  const { isOpen } = useFloatingBookingDrawer()
  const phone = window.matchMedia('(width < 576px)')
  const supportModalOpen = useState('dobrodesk-mobile-modal-open', () => false)
  const status = ref<'loading' | 'ready' | 'error'>('loading')
  const createLifecycle = (container?: HTMLElement) => createDobrodeskLifecycle({
    integrationId: config.public.dobrodeskIntegrationId,
    enabled: isDobrodeskEnabled(config.public.dobrodeskEnabled),
    customLauncher: true,
    appearance: barbershopSupportAppearance,
    onStatus: container ? value => { status.value = value } : undefined,
    load: async () => {
      const { createSandboxedDobroDeskWidget } = await import('~/utils/dobrodeskSandbox')
      return {
        createDobroDeskWidget: (options) => createSandboxedDobroDeskWidget(
          { ...options, container },
          config.public.dobrodeskFrameUrl,
          container ? () => { supportModalOpen.value = false } : undefined,
        ),
      }
    },
  })
  let lifecycle = phone.matches ? undefined : createLifecycle()
  const supportOpenRequest = useState('dobrodesk-open-request', () => 0)
  const stopOpenRequest = watch(supportOpenRequest, () => {
    if (!phone.matches) lifecycle?.open()
  })
  const update = () => {
    const allowed = isDobrodeskPublicRoute(router.currentRoute.value, config.app.baseURL) && !isPrivateReviewRoute.value
    const visible = !isOpen.value
    if (!allowed || !visible) supportModalOpen.value = false
    lifecycle?.update({ allowed, visible, locale: locale.value })
  }
  // Hide before navigation commits; never initialize on private/query/hash routes.
  const removeGuard = router.beforeEach(() => {
    supportModalOpen.value = false
    lifecycle?.update({ allowed: false, visible: false, locale: locale.value })
  })
  const removeAfter = router.afterEach(update)
  const stop = watch(() => [router.currentRoute.value.fullPath, locale.value, isOpen.value, isPrivateReviewRoute.value], update, { immediate: true, flush: 'sync' })
  const changeViewport = () => {
    supportModalOpen.value = false
    lifecycle?.dispose()
    lifecycle = phone.matches ? undefined : createLifecycle()
    update()
  }
  phone.addEventListener('change', changeViewport)
  const setSupportContainer = (container: HTMLElement | null) => {
    if (!phone.matches) return
    lifecycle?.dispose()
    lifecycle = undefined
    if (!container || !supportModalOpen.value) return
    status.value = 'loading'
    lifecycle = createLifecycle(container)
    update()
    lifecycle.open()
  }
  if (import.meta.hot) import.meta.hot.dispose(() => {
    stopOpenRequest(); stop(); removeGuard(); removeAfter(); lifecycle?.dispose()
    phone.removeEventListener('change', changeViewport)
  })
  return { provide: { supportModal: { setContainer: setSupportContainer, status } } }
})

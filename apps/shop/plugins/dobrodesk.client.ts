import { shopSupportAppearance, createDobrodeskLifecycle, isDobrodeskEnabled, isDobrodeskPublicRoute } from '~/utils/dobrodesk'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const router = useRouter()
  const { locale } = useShopLocale()
  const modal = useModalStore()
  const auth = useCustomerAuthStore()
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const lifecycle = createDobrodeskLifecycle({
    integrationId: config.public.dobrodeskIntegrationId,
    enabled: isDobrodeskEnabled(config.public.dobrodeskEnabled),
    appearance: shopSupportAppearance,
    customLauncher: true,
    onStatus: value => { status.value = value },
    load: () => import('@dobrodesk/widget'),
  })
  const update = () => lifecycle.update({
    allowed: isDobrodeskPublicRoute(router.currentRoute.value, config.app.baseURL)
      && (!/\/cabinet\/contact\/?$/.test(router.currentRoute.value.path) || auth.isAuthenticated),
    visible: !modal.activeModal,
    locale: locale.value,
  })
  // Hide before navigation commits; only the approved cabinet contact route is eligible.
  const removeGuard = router.beforeEach(() => {
    lifecycle.update({ allowed: false, visible: false, locale: locale.value })
  })
  const removeAfter = router.afterEach(update)
  const stop = watch(() => [router.currentRoute.value.fullPath, locale.value, modal.activeModal, auth.isAuthenticated], update, { immediate: true, flush: 'sync' })
  if (import.meta.hot) import.meta.hot.dispose(() => {
    stop(); removeGuard(); removeAfter(); lifecycle.dispose()
  })
  return { provide: { shopSupport: { open: () => lifecycle.open(), status } } }
})

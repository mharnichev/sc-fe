import { shopSupportAppearance, createDobrodeskLifecycle, isDobrodeskEnabled, isDobrodeskPublicRoute } from '~/utils/dobrodesk'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const router = useRouter()
  const { locale } = useShopLocale()
  const lifecycle = createDobrodeskLifecycle({
    integrationId: config.public.dobrodeskIntegrationId,
    enabled: isDobrodeskEnabled(config.public.dobrodeskEnabled),
    appearance: shopSupportAppearance,
    load: () => import('@dobrodesk/widget'),
  })
  const update = () => lifecycle.update({
    allowed: isDobrodeskPublicRoute(router.currentRoute.value, config.app.baseURL),
    visible: true,
    locale: locale.value,
  })
  // Hide before navigation commits; never initialize on private/query/hash routes.
  const removeGuard = router.beforeEach(() => {
    lifecycle.update({ allowed: false, visible: false, locale: locale.value })
  })
  const removeAfter = router.afterEach(update)
  const stop = watch(() => [router.currentRoute.value.fullPath, locale.value], update, { immediate: true, flush: 'sync' })
  // Defer third-party loading until the visitor interacts with a public page.
  const activate = () => { removeActivation(); lifecycle.activate() }
  const removeActivation = () => {
    window.removeEventListener('pointerdown', activate)
    window.removeEventListener('keydown', activate)
  }
  nuxtApp.hook('app:mounted', () => {
    window.addEventListener('pointerdown', activate, { once: true, passive: true })
    window.addEventListener('keydown', activate, { once: true })
  })
  if (import.meta.hot) import.meta.hot.dispose(() => {
    stop(); removeGuard(); removeAfter(); removeActivation(); lifecycle.dispose()
  })
})

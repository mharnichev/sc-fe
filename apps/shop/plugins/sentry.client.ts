import * as Sentry from '@sentry/vue'
import { commerceHttpStatus, configureCommerceTelemetry, reportCommerceError, safeCommerceData, safeCommerceLabel } from '~/utils/commerceTelemetry'

const safeStackFilename = (filename?: string) => {
  try {
    const url = new URL(filename || '', window.location.origin)
    return url.origin === window.location.origin && /^\/(?:shop\/)?_nuxt\/[A-Za-z0-9_./-]+\.m?js$/.test(url.pathname) ? url.pathname : undefined
  } catch { return undefined }
}

export default defineNuxtPlugin(nuxtApp => {
  const config = useRuntimeConfig().public
  const router = useRouter()
  const auth = useCustomerAuthStore()
  if (!config.sentryDsn || config.sentryEnvironment !== 'production') return
  try {
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.sentryEnvironment,
      release: config.sentryRelease || undefined,
      // Explicit capture only: no console, DOM, fetch, session, replay or tracing collection.
      defaultIntegrations: false,
      integrations: [],
      sendDefaultPii: false,
      sampleRate: 1,
      maxBreadcrumbs: 30,
      beforeSend(event) {
        if (event.tags?.critical !== 'true' || !['checkout', 'payment'].includes(String(event.tags?.flow))) return null
        const step = safeCommerceLabel(event.tags.step)
        if (!step) return null
        const flow = String(event.tags.flow)
        const provider = flow === 'payment' ? 'monobank' : 'storefront'
        const data = safeCommerceData(event.contexts?.commerce || {})
        // Reconstruct an allowlisted event: never forward SDK/request/scope payloads.
        return {
          type: event.type,
          event_id: event.event_id,
          timestamp: event.timestamp,
          platform: event.platform,
          environment: config.sentryEnvironment,
          release: config.sentryRelease || undefined,
          level: 'error',
          tags: { app: 'shop', critical: 'true', flow, step, provider, payment_method: data.payment_method || '', http_status: String(data.http_status || '') },
          fingerprint: ['commerce', flow, step, String(data.http_status || 'internal')],
          contexts: { commerce: { ...data } },
          exception: { values: event.exception?.values?.map(value => ({
            type: 'Error', value: `Commerce failure: ${String(event.tags?.step)}`,
            stacktrace: { frames: value.stacktrace?.frames?.map(frame => ({
              filename: safeStackFilename(frame.filename),
              lineno: frame.lineno, colno: frame.colno, in_app: frame.in_app,
            })) },
          })) },
          breadcrumbs: event.breadcrumbs?.filter(item => item.category === 'commerce' && safeCommerceLabel(item.message)).map(item => ({ category: 'commerce', message: item.message, data: safeCommerceData(item.data || {}), timestamp: item.timestamp, level: 'info' })),
        }
      },
    })
    const capture: Parameters<typeof configureCommerceTelemetry>[0] = ({ step, data, error }) => {
      if (!error) { Sentry.addBreadcrumb({ category: 'commerce', message: step, data, level: 'info' }); return }
      Sentry.withScope(scope => {
        scope.setTags({ app: 'shop', critical: 'true', flow: data.flow || 'checkout', step, provider: data.flow === 'payment' ? 'monobank' : 'storefront', ...(data.payment_method ? { payment_method: data.payment_method } : {}), ...(data.http_status ? { http_status: String(data.http_status) } : {}) })
        scope.setContext('commerce', { ...data })
        scope.setFingerprint(['commerce', data.flow || 'checkout', step, String(data.http_status || 'internal')])
        Sentry.captureException(error)
      })
    }
    configureCommerceTelemetry(capture)
    watch(() => auth.sessionRevision, () => {
      try {
        Sentry.getIsolationScope().clearBreadcrumbs()
        configureCommerceTelemetry(capture)
      } catch { configureCommerceTelemetry() }
    }, { flush: 'sync' })
    const unhandled = (error: unknown) => {
      const path = router.currentRoute.value.path
      const flow = /^\/checkout(?:\/|$)/.test(path) ? 'checkout' : /^\/payment\/|^\/cabinet\/orders\/|^\/tracking\//.test(path) ? 'payment' : undefined
      // Report programming failures blocking commerce. HTTP/business failures are handled at source.
      if (flow && error instanceof Error && ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError'].includes(error.name) && !commerceHttpStatus(error)) reportCommerceError('unhandled_code', error, { flow })
    }
    nuxtApp.hook('vue:error', unhandled)
    nuxtApp.hook('app:error', unhandled)
    window.addEventListener('error', event => unhandled(event.error))
    window.addEventListener('unhandledrejection', event => unhandled(event.reason))
  } catch { configureCommerceTelemetry() }
})

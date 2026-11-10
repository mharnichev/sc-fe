import * as Sentry from '@sentry/vue'

export default defineNuxtPlugin(nuxtApp => {
  const router = useRouter()
  const { sentryDsn, sentryEnvironment, sentryRelease } = useRuntimeConfig().public
  let enabled = false
  if (sentryDsn) {
    try {
      Sentry.init({
        dsn: sentryDsn,
        environment: sentryEnvironment,
        release: sentryRelease || undefined,
        defaultIntegrations: false,
        integrations: [],
        sendDefaultPii: false,
        beforeSend(event) {
          const code = event.tags?.code
          if (code !== 'order_cancellation_read_failed' && code !== 'order_cancellation_submit_failed' && code !== 'order_archive_render_failed') return null
          const requestId = event.contexts?.diagnostic?.request_id
          return {
            type: event.type,
            event_id: event.event_id,
            timestamp: event.timestamp,
            platform: event.platform,
            environment: sentryEnvironment,
            release: sentryRelease || undefined,
            level: 'error',
            message: code,
            tags: { app: 'backoffice', code, http_status: String(event.tags?.http_status || '') },
            contexts: typeof requestId === 'string' ? { diagnostic: { request_id: requestId } } : undefined,
            fingerprint: ['backoffice', code, String(event.tags?.http_status || '')],
          }
        },
      })
      enabled = true
    } catch { /* Monitoring must never interrupt an order action. */ }
  }

  const reportOrderCancellationError = (stage: 'read' | 'submit' | 'render', cause: unknown) => {
    if (!enabled) return
    const error = cause as { response?: Response, statusCode?: number } | null
    const status = error?.response?.status ?? error?.statusCode
    if (status && status < 500) return
    const requestId = error?.response?.headers?.get('x-request-id')
    const code = {
      read: 'order_cancellation_read_failed',
      submit: 'order_cancellation_submit_failed',
      render: 'order_archive_render_failed',
    }[stage]
    try {
      Sentry.withScope(scope => {
        scope.setTag('code', code)
        if (typeof status === 'number') scope.setTag('http_status', status)
        if (requestId && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(requestId)) {
          scope.setContext('diagnostic', { request_id: requestId })
        }
        Sentry.captureMessage(code, 'error')
      })
    } catch { /* Keep retries available when telemetry fails. */ }
  }

  nuxtApp.hook('vue:error', error => {
    const path = router.currentRoute.value.path
    if (/^\/orders(?:\/\d+)?\/?$/.test(path)) reportOrderCancellationError('render', error)
  })

  return { provide: { reportOrderCancellationError } }
})

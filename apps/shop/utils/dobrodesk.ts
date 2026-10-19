import type { DobroDeskWidgetClient, DobroDeskWidgetOptions } from '@dobrodesk/widget'

export const shopSupportAppearance: DobroDeskWidgetOptions['appearance'] = {
  mode: 'light',
  lightSurfaceStyle: 'white',
  tokens: {
    light: {
      surface: '#ffffff',
      raisedSurface: '#f5f5f4',
      text: '#0a0a0a',
      mutedText: '#57534e',
      border: '#d6d3d1',
      accent: '#0a0a0a',
      onAccent: '#ffffff',
      link: '#0a0a0a',
      focus: '#0a0a0a',
    },
    dark: {
      surface: '#0a0a0a',
      raisedSurface: '#171717',
      text: '#fafafa',
      mutedText: '#b5b5b5',
      border: '#404040',
      accent: '#fafafa',
      onAccent: '#0a0a0a',
      link: '#fafafa',
      focus: '#fafafa',
    },
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    lineHeight: 1.5,
    controlRadius: '4px',
    borderWidth: '1px',
    shadow: 'soft',
  },
  layout: { placement: 'bottom-right', offsetBlock: 88 },
}

export const isDobrodeskEnabled = (value: unknown) => String(value) === 'true'

type Route = { name?: string | symbol | null, path: string, query: Record<string, unknown>, hash: string }
type WidgetState = { allowed: boolean, visible: boolean, locale: string }

// Only public, query-free pages may load the third-party support runtime.
export const isDobrodeskPublicRoute = (route: Route, baseURL = '/') => {
  if (route.hash || Object.keys(route.query).length) return false
  let path = route.path
  const base = baseURL.replace(/\/$/, '')
  if (base && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length) || '/'
  path = path.replace(/\/$/, '') || '/'
  if (/\/(booking|cabinet|account|checkout|auth|login|logout|register|password|reset-password|payment|orders|review|api|admin|blog)(?:\/|$)/i.test(path)) return false
  // Nuxt's [...slug].vue is the public category landing/goods route.
  if (route.name === 'slug' && /^\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(path)) return true
  return ['/', '/catalog', '/top', '/contacts', '/delivery-payment'].includes(path)
    || /^\/(products|catalog)\/[^/]+(?:\/[^/]+)*$/.test(path)
}

export const createDobrodeskLifecycle = (options: {
  integrationId: string
  enabled: boolean
  appearance: DobroDeskWidgetOptions['appearance']
  load: () => Promise<{ createDobroDeskWidget: (options: DobroDeskWidgetOptions) => DobroDeskWidgetClient }>
}) => {
  let state: WidgetState = { allowed: false, visible: false, locale: 'uk' }
  let client: DobroDeskWidgetClient | undefined
  let ready = false
  let pending = false
  let activated = false
  let disposed = false
  let failed = false

  const present = () => {
    if (!client) return
    if (!ready) { client.close(); client.hide(); return }
    client.setLocale(state.locale)
    if (state.allowed && state.visible) { client.setLauncherVisibility(true); client.show() }
    else { client.close(); client.hide() }
  }

  const start = async () => {
    if (disposed || failed || pending || client || !activated || !state.allowed || !options.enabled || !options.integrationId) return
    pending = true
    try {
      const sdk = await options.load()
      if (disposed || !state.allowed) return
      client = sdk.createDobroDeskWidget({
        integrationId: options.integrationId,
        locale: state.locale,
        launcher: 'hidden',
        appearance: options.appearance,
      })
      await client.ready
      if (disposed) return
      ready = true
      present()
    }
    catch (error) {
      if (import.meta.dev) console.warn('[Dobrodesk] Widget initialization failed', error)
      failed = true
      client?.destroy()
      client = undefined
      // Support must never interrupt the site's booking or shopping flows.
    }
    finally { pending = false }
  }

  return {
    update(next: WidgetState) { state = next; present(); void start() },
    activate() { activated = true; void start() },
    dispose() { disposed = true; client?.destroy(); client = undefined },
  }
}

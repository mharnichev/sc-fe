import type { DobroDeskWidgetClient, DobroDeskWidgetOptions } from '@dobrodesk/widget'

export const barbershopSupportAppearance: DobroDeskWidgetOptions['appearance'] = {
  mode: 'dark',
  lightSurfaceStyle: 'white',
  tokens: {
    light: {
      surface: '#ffffff', raisedSurface: '#f5f5f4', text: '#0a0a0a',
      mutedText: '#57534e', border: '#d6d3d1', accent: '#ffca2b',
      onAccent: '#0a0a0a', link: '#0a0a0a', focus: '#0a0a0a',
    },
    dark: {
      surface: '#0a0a0a',
      raisedSurface: '#171717',
      text: '#fafafa',
      mutedText: '#b5b5b5',
      border: '#404040',
      accent: '#ffca2b',
      onAccent: '#0a0a0a',
      link: '#ffca2b',
      focus: '#ffca2b',
    },
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    lineHeight: 1.5,
    controlRadius: '4px',
    borderWidth: '1px',
    shadow: 'strong',
  },
  layout: { placement: 'bottom-right', offsetBlock: 128, offsetInline: 44, mobileFullscreen: false },
}

export const isDobrodeskEnabled = (value: unknown) => String(value) === 'true'

type Route = { path: string, query: Record<string, unknown>, hash: string }
type WidgetState = { allowed: boolean, visible: boolean, locale: string }
type SupportClient = Pick<DobroDeskWidgetClient, 'ready' | 'open' | 'close' | 'show' | 'hide' | 'setLocale' | 'setLauncherVisibility' | 'destroy'>

// Only public, query-free pages may load the third-party support runtime.
export const isDobrodeskPublicRoute = (route: Route, baseURL = '/') => {
  if (route.hash || Object.keys(route.query).length) return false
  let path = route.path
  const base = baseURL.replace(/\/$/, '')
  if (base && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length) || '/'
  if (path === '/en' || path.startsWith('/en/')) path = path.slice(3) || '/'
  path = path.replace(/\/$/, '') || '/'
  return ['/', '/about', '/contacts', '/terms', '/barbershop-odesa', '/services', '/masters'].includes(path)
    || /^\/(services|masters)\/[^/]+$/.test(path)
}

export const createDobrodeskLifecycle = (options: {
  integrationId: string
  enabled: boolean
  customLauncher?: boolean
  appearance: DobroDeskWidgetOptions['appearance']
  load: () => Promise<{ createDobroDeskWidget: (options: DobroDeskWidgetOptions) => SupportClient }>
}) => {
  let state: WidgetState = { allowed: false, visible: false, locale: 'uk' }
  let client: SupportClient | undefined
  let ready = false
  let pending = false
  let activated = false
  let disposed = false
  let failed = false
  let openRequested = false

  const present = () => {
    if (!client) return
    if (!ready) { client.close(); client.hide(); return }
    client.setLocale(state.locale)
    if (state.allowed && state.visible) { client.setLauncherVisibility(!options.customLauncher); client.show(); if (openRequested) { openRequested = false; client.open() } }
    else { openRequested = false; client.close(); client.hide() }
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
    catch {
      failed = true
      client?.destroy()
      client = undefined
      // Support must never interrupt the site's booking or shopping flows.
    }
    finally { pending = false }
  }

  return {
    update(next: WidgetState) { state = next; if (!next.allowed || !next.visible) openRequested = false; present(); void start() },
    activate() { activated = true; void start() },
    open() { if (!state.allowed || !state.visible) return; failed = false; openRequested = true; activated = true; present(); void start() },
    dispose() { disposed = true; client?.destroy(); client = undefined },
  }
}

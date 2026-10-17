import type { DobroDeskWidgetOptions } from '@dobrodesk/widget'

// A different origin is required: the provider rejects opaque-origin requests.
export const createSandboxedDobroDeskWidget = (_options: DobroDeskWidgetOptions, frameUrl: string) => {
  const target = new URL(frameUrl)
  if (target.origin === window.location.origin) throw new Error('Support requires a separate origin')
  const frame = document.createElement('iframe')
  frame.id = 'dobrodesk-support-sandbox'
  frame.title = 'Soul Cuts support'
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups')
  frame.referrerPolicy = 'no-referrer'
  frame.hidden = true
  frame.src = target.href
  let rejectReady = (_reason: Error) => {}
  let timeout: ReturnType<typeof setTimeout> | undefined
  let cleanup = () => {}
  let permitted = false
  const ready = new Promise<void>((resolve, reject) => {
    rejectReady = reject
    timeout = setTimeout(() => reject(new Error('Support unavailable')), 20000)
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== target.origin || event.data?.source !== 'soulcuts-support') return
      if (event.data.type === 'presentation') { frame.hidden = !permitted || event.data.open !== true; return }
      if (!['ready', 'error'].includes(event.data.type)) return
      clearTimeout(timeout)
      event.data.type === 'ready' ? resolve() : reject(new Error('Support unavailable'))
    }
    window.addEventListener('message', receive)
    cleanup = () => window.removeEventListener('message', receive)
  })
  const command = (name: string, value?: unknown) => frame.contentWindow?.postMessage({ source: 'soulcuts-support', command: name, value }, target.origin)
  document.body.append(frame)
  // The host exposes only presentation commands, never identity or page context.
  return {
    ready,
    open: () => { if (permitted) { frame.hidden = false; command('open') } },
    close: () => command('close'),
    show: () => { permitted = true; command('show') },
    hide: () => { permitted = false; frame.hidden = true; command('hide') },
    setLocale: (value: string) => command('setLocale', value),
    setLauncherVisibility: (value: boolean) => command('setLauncherVisibility', value),
    destroy: () => { clearTimeout(timeout); cleanup(); frame.remove(); rejectReady(new Error('Support disposed')) },
  }
}

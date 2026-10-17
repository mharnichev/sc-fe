import { barbershopSupportAppearance } from '../../utils/dobrodesk'

export default defineEventHandler((event) => {
  if (getRequestURL(event).hostname !== 'www.soulcuts.com.ua') throw createError({ statusCode: 404 })
  const config = useRuntimeConfig(event)
  const parentOrigin = new URL(config.public.siteUrl).origin
  const integrationId = config.public.dobrodeskIntegrationId
  if (!config.public.dobrodeskEnabled || !/^wgt_[a-zA-Z0-9_-]+$/.test(integrationId)) throw createError({ statusCode: 404 })
  setResponseHeaders(event, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': `default-src 'none'; script-src 'unsafe-inline' https://widget.dobrodesk.com; style-src 'unsafe-inline'; frame-src https://widget.dobrodesk.com; connect-src https://widget.dobrodesk.com wss://widget.dobrodesk.com; img-src https: data:; base-uri 'none'; form-action https://widget.dobrodesk.com; frame-ancestors ${parentOrigin}`,
  })
  const serialized = JSON.stringify({ parentOrigin, integrationId, appearance: barbershopSupportAppearance }).replace(/</g, '\\u003c')
  return `<!doctype html><html><head><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;overflow:hidden}#dobrodesk-widget-frame{inset:0!important;width:100%!important;height:100%!important;max-height:100%!important}</style></head><body><script>
    const config = ${serialized};
    const send = (type, extra = {}) => parent.postMessage({source:'soulcuts-support',type,...extra}, config.parentOrigin);
    window.DobroDeskWidget = [];
    const command = (name, value) => typeof window.DobroDeskWidget === 'function' ? window.DobroDeskWidget(name, value) : window.DobroDeskWidget.push([name, value]);
    const methods = new Set(['open','close','show','hide','setLocale','setLauncherVisibility']);
    window.addEventListener('message', event => {
      if(event.source !== parent || event.origin !== config.parentOrigin || event.data?.source !== 'soulcuts-support' || !methods.has(event.data.command)) return;
      const {command:name,value} = event.data;
      if(name === 'setLocale' && !['uk','en'].includes(value)) return;
      if(name === 'setLauncherVisibility' && typeof value !== 'boolean') return;
      command(name, value);
    });
    window.addEventListener('dobrodesk:ready', event => { if(event.detail?.integrationId === config.integrationId) send('ready') });
    window.addEventListener('dobrodesk:error', () => send('error'));
    window.addEventListener('dobrodesk:state', event => {
      if(event.detail?.integrationId !== config.integrationId) return;
      const state = event.detail.state;
      send('presentation', {open:state?.presentation === 'panel' && state?.visible === true});
    });
    const script = document.createElement('script');
    script.src = 'https://widget.dobrodesk.com/widget/loader/v1.min.js';
    script.dataset.dobrodeskIntegration = config.integrationId;
    script.dataset.dobrodeskLocale = 'uk';
    script.dataset.dobrodeskLauncher = 'hidden';
    script.dataset.dobrodeskAppearance = JSON.stringify(config.appearance);
    script.onerror = () => send('error');
    document.head.append(script);
  </script></body></html>`
})

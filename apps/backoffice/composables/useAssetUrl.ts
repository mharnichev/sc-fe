import { resolveApiAssetUrl, type ApiAssetValue } from '../../../packages/shared-utils/src/index'

export const useAssetUrl = () => {
  const config = useRuntimeConfig()
  const apiBase = typeof config.public.apiBase === 'string' ? config.public.apiBase : ''
  const clientOrigin = import.meta.client ? window.location.origin : ''

  return (value: ApiAssetValue) => {
    const resolved = resolveApiAssetUrl(value, apiBase, clientOrigin)
    if (!resolved) return resolved

    // The admin host serves the app; uploaded media lives on the public site.
    try {
      const url = new URL(resolved, clientOrigin || undefined)
      if (url.hostname === 'admin.soulcuts.com.ua' && url.pathname.startsWith('/media/')) {
        return `https://soulcuts.com.ua${url.pathname}${url.search}${url.hash}`
      }
    } catch {
      // Keep local paths and non-URL values as resolved by the API helper.
    }
    return resolved
  }
}

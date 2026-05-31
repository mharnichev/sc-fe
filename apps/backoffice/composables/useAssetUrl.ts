import { resolveApiAssetUrl, type ApiAssetValue } from '../../../packages/shared-utils/src/index'

export const useAssetUrl = () => {
  const config = useRuntimeConfig()
  const apiBase = typeof config.public.apiBase === 'string' ? config.public.apiBase : ''
  const clientOrigin = import.meta.client ? window.location.origin : ''

  return (value: ApiAssetValue) =>
    resolveApiAssetUrl(value, apiBase, clientOrigin)
}

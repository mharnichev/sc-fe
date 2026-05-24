import { resolveApiAssetUrl, type ApiAssetValue } from '../../../packages/shared-utils/src/index'

export const useAssetUrl = () => {
  const config = useRuntimeConfig()
  const clientOrigin = import.meta.client ? window.location.origin : ''

  return (value: ApiAssetValue) =>
    resolveApiAssetUrl(value, config.public.apiBase, clientOrigin)
}

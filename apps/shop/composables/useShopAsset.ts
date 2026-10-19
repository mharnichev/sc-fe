export const useShopAsset = () => {
  const config = useRuntimeConfig()
  return (path: string) => path ? `${config.app.baseURL.replace(/\/$/, '')}/${path.replace(/^\//, '')}` : ''
}

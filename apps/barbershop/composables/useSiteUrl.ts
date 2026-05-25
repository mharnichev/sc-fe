export const useSiteUrl = () => {
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl || '').replace(/\/+$/, '')

  const absoluteUrl = (path = '/') => {
    if (/^https?:\/\//i.test(path)) return path

    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${siteUrl}${normalizedPath}`
  }

  return { siteUrl, absoluteUrl }
}

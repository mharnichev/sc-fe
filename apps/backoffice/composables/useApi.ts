export const useApi = () => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  const apiBase = typeof config.public.apiBase === 'string' ? config.public.apiBase : ''

  return $fetch.create({
    baseURL: apiBase,
    onRequest({ options }) {
      if (auth.accessToken) {
        const headers = new Headers(options.headers || {})
        headers.set('Authorization', `Bearer ${auth.accessToken}`)
        options.headers = headers
      }
    },
    onResponseError({ response }) {
      if (response.status === 401 && auth.accessToken) {
        auth.logout()
      }
    },
  })
}

export const useApi = () => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()

  return $fetch.create({
    baseURL: config.public.apiBase,
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

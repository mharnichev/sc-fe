export const useApi = () => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()

  return $fetch.create({
    baseURL: config.public.apiBase,
    onRequest({ options }) {
      if (auth.accessToken) {
        options.headers = {
          ...(options.headers || {}),
          Authorization: `Bearer ${auth.accessToken}`,
        }
      }
    },
    onResponseError({ response }) {
      if (response.status === 401 && auth.accessToken) {
        auth.logout()
      }
    },
  })
}

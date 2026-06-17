export const useApi = () => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  const apiBase = typeof config.public.apiBase === 'string' ? config.public.apiBase : ''
  type ApiFetch = ReturnType<typeof $fetch.create>
  type ApiRequest = Parameters<ApiFetch>[0]
  type ApiOptions = Parameters<ApiFetch>[1]

  const rawApi = $fetch.create({
    baseURL: apiBase,
    onRequest({ options }) {
      if (auth.accessToken) {
        const headers = new Headers(options.headers || {})
        headers.set('Authorization', `Bearer ${auth.accessToken}`)
        options.headers = headers
      }
    },
  })

  const api = (async <T = unknown>(request: ApiRequest, options?: ApiOptions) => {
    try {
      return await rawApi<T>(request, options)
    }
    catch (cause: any) {
      if (cause?.response?.status !== 401 || !auth.refreshToken) {
        throw cause
      }

      if (!await auth.refreshSession()) {
        await auth.logout()
        throw cause
      }

      try {
        return await rawApi<T>(request, options)
      }
      catch (retryCause: any) {
        if (retryCause?.response?.status === 401) {
          await auth.logout()
        }
        throw retryCause
      }
    }
  }) as ApiFetch

  return api
}

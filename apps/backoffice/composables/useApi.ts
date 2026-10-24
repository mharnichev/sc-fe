export const useApi = (settings: { refreshOnUnauthorized?: boolean } = {}) => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  const apiBase = typeof config.public.apiBase === 'string' ? config.public.apiBase : ''
  type ApiFetch = ReturnType<typeof $fetch.create>
  type ApiRequest = Parameters<ApiFetch>[0]
  type ApiOptions = Parameters<ApiFetch>[1]

  const rawApi = $fetch.create({
    baseURL: apiBase,
    cache: 'no-store',
    retry: 0,
    onRequest({ options }) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Немає з’єднання. Зміни не надіслано. Підключіться до інтернету та перевірте дані перед повторною спробою.')
      }
      if (auth.accessToken) {
        const headers = new Headers(options.headers || {})
        headers.set('Authorization', `Bearer ${auth.accessToken}`)
        options.headers = headers
      }
    },
  })

  const api = (async <T = unknown>(request: ApiRequest, options?: ApiOptions) => {
    const sessionRevision = auth.sessionRevision
    const actorId = auth.user?.id
    const current = () => auth.sessionRevision === sessionRevision && auth.user?.id === actorId
    try {
      return await rawApi<T>(request, options)
    }
    catch (cause: any) {
      if (settings.refreshOnUnauthorized === false || !current() || cause?.response?.status !== 401 || !auth.refreshToken) {
        throw cause
      }

      if (!await auth.refreshSession()) {
        const expiredSession = auth.sessionRevision === sessionRevision + 1
          && !auth.accessToken && !auth.refreshToken && !auth.user
        if (current() || expiredSession) await auth.logout()
        throw cause
      }
      if (!current()) throw cause

      try {
        return await rawApi<T>(request, options)
      }
      catch (retryCause: any) {
        if (current() && retryCause?.response?.status === 401) {
          await auth.logout()
        }
        throw retryCause
      }
    }
  }) as ApiFetch

  return api
}

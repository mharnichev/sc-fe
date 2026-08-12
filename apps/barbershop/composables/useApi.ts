const isRelativeApiPath = (request: unknown) =>
  typeof request === 'string'
  && request.startsWith('/')
  && !request.startsWith('//')

export const useApi = () => {
  const config = useRuntimeConfig()

  return $fetch.create({
    baseURL: config.public.apiBase,
    // Requests stay on our own Nitro boundary. The proxy decides which exact
    // upstream endpoints may receive the browser's HttpOnly session cookie.
    credentials: 'same-origin',
    retry: 0,
    onRequest({ request }) {
      if (!isRelativeApiPath(request)) {
        throw new Error('Barbershop API requests must use same-boundary relative paths')
      }
    },
  })
}

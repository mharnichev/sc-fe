const isRelativeApiPath = (request: unknown) =>
  typeof request === 'string'
  && request.startsWith('/')
  && !request.startsWith('//')

export const useApi = () => {
  const config = useRuntimeConfig()

  return $fetch.create({
    baseURL: config.public.apiBase,
    credentials: 'omit',
    retry: 0,
    onRequest({ request }) {
      if (!isRelativeApiPath(request)) {
        throw new Error('Barbershop API requests must use same-boundary relative paths')
      }
    },
  })
}

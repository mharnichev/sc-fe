const isSecureCookieContext = () => {
  if (import.meta.client) {
    return window.location.protocol === 'https:'
  }

  return useRequestURL().protocol === 'https:'
}

export const useBarbershopCookieOptions = (options = {}) => ({
  path: '/',
  sameSite: 'lax' as const,
  secure: isSecureCookieContext(),
  ...options,
})

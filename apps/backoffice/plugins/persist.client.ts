export default defineNuxtPlugin(() => {
  const auth = useAuthStore()
  const snapshot = localStorage.getItem('backoffice-auth')

  if (snapshot) {
    try {
      const restored = JSON.parse(snapshot) as Record<string, unknown>
      auth.$patch({
        accessToken: typeof restored.accessToken === 'string' ? restored.accessToken : '',
        refreshToken: typeof restored.refreshToken === 'string' ? restored.refreshToken : '',
        user: restored.user && typeof restored.user === 'object' ? restored.user as typeof auth.user : null,
        initialized: false,
      })
    }
    catch {
      localStorage.removeItem('backoffice-auth')
    }
  }

  auth.$subscribe((_mutation, state) => {
    if (!state.accessToken && !state.refreshToken) {
      localStorage.removeItem('backoffice-auth')
      return
    }

    localStorage.setItem(
      'backoffice-auth',
      JSON.stringify({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    )
  })
})

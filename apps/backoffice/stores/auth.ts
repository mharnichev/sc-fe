let authInitPromise: Promise<void> | null = null
let refreshSessionPromise: Promise<boolean> | null = null

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: '',
    refreshToken: '',
    user: null as null | {
      id: number
      email: string
      full_name?: string | null
      role?: string | null
      master_id?: number | null
      is_active: boolean
      is_superuser: boolean
      created_at: string
      updated_at: string
    },
    initialized: false,
  }),
  actions: {
    async login(email: string, password: string) {
      const api = useBackofficeApi()
      const tokens = await api.login(email, password)
      this.accessToken = tokens.access_token
      this.refreshToken = tokens.refresh_token
      this.user = await api.me()
      this.initialized = true
    },
    async init() {
      if (this.initialized) return
      if (authInitPromise) return authInitPromise
      authInitPromise = (async () => {
        try {
          if (!this.accessToken && !await this.refreshSession()) {
            this.user = null
            return
          }

          const api = useBackofficeApi()
          try {
            this.user = await api.me()
          }
          catch {
            if (!await this.refreshSession()) {
              this.clearSession()
              return
            }
            this.user = await api.me()
          }
        }
        catch {
          this.clearSession()
        }
        finally {
          this.initialized = true
          authInitPromise = null
        }
      })()

      return authInitPromise
    },
    async refreshSession() {
      if (!this.refreshToken) return false
      if (refreshSessionPromise) return refreshSessionPromise

      refreshSessionPromise = (async () => {
        const config = useRuntimeConfig()
        const apiBase = typeof config.public.apiBase === 'string' ? config.public.apiBase : ''
        try {
          const tokens = await $fetch<{ access_token: string, refresh_token: string, token_type: string }>(
            '/backoffice/auth/refresh',
            {
              baseURL: apiBase,
              method: 'POST',
              body: { refresh_token: this.refreshToken },
            },
          )
          this.accessToken = tokens.access_token
          this.refreshToken = tokens.refresh_token
          return true
        }
        catch {
          this.clearSession()
          return false
        }
        finally {
          refreshSessionPromise = null
        }
      })()

      return refreshSessionPromise
    },
    clearSession() {
      this.accessToken = ''
      this.refreshToken = ''
      this.user = null
      this.initialized = true
    },
    logout() {
      this.clearSession()
      if (import.meta.client) {
        const selectedTheme = localStorage.getItem('soulcuts-backoffice-theme')
        localStorage.removeItem('backoffice-auth')
        if (selectedTheme === 'light' || selectedTheme === 'dark') {
          localStorage.setItem('soulcuts-backoffice-theme', selectedTheme)
        }
      }
      return navigateTo('/login')
    },
  },
})

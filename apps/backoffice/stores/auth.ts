let authInitPromise: Promise<void> | null = null
let refreshSessionPromise: Promise<boolean> | null = null
let refreshSessionRevision = -1

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
      can_manage_fiscal_settings?: boolean
      can_fiscalize_sales?: boolean
      can_fiscalize_returns?: boolean
      can_accept_qr_payments?: boolean
      can_record_sales?: boolean
      can_post_inventory?: boolean
      is_superuser: boolean
      created_at: string
      updated_at: string
    },
    initialized: false,
    sessionRevision: 0,
  }),
  actions: {
    async login(email: string, password: string) {
      this.clearSession()
      const revision = this.sessionRevision
      const assertCurrent = () => {
        if (revision !== this.sessionRevision) throw new Error('Backoffice session changed')
      }
      const api = useBackofficeApi()
      try {
        const tokens = await api.login(email, password)
        assertCurrent()
        this.accessToken = tokens.access_token
        this.refreshToken = tokens.refresh_token
        const user = await api.me()
        assertCurrent()
        this.user = user
        this.initialized = true
      }
      catch (error) {
        if (revision === this.sessionRevision) this.clearSession()
        throw error
      }
    },
    async init() {
      if (this.initialized) return
      if (authInitPromise) return authInitPromise
      const revision = this.sessionRevision
      const current = () => revision === this.sessionRevision
      authInitPromise = (async () => {
        try {
          if (!this.accessToken && !await this.refreshSession()) {
            if (current()) this.user = null
            return
          }
          if (!current()) return

          const api = useBackofficeApi()
          try {
            const user = await api.me()
            if (current()) this.user = user
          }
          catch (cause: any) {
            if (!current()) return
            if (cause?.response?.status !== 401 && cause?.response?.status !== 403) throw cause
            const refreshed = await this.refreshSession()
            if (!current()) return
            if (!refreshed) {
              this.clearSession()
              return
            }
            const user = await api.me()
            if (current()) this.user = user
          }
        }
        catch (cause: any) {
          if (!current()) return
          if (cause?.response?.status === 401 || cause?.response?.status === 403) this.clearSession()
          else this.user = null // Require a fresh identity check after reconnecting; retain credentials for retry.
        }
        finally {
          if (current()) this.initialized = true
          authInitPromise = null
        }
      })()

      return authInitPromise
    },
    async refreshSession() {
      if (!this.refreshToken) return false
      const revision = this.sessionRevision
      const refreshToken = this.refreshToken
      const current = () => revision === this.sessionRevision
      if (refreshSessionPromise && refreshSessionRevision === revision) return refreshSessionPromise
      refreshSessionRevision = revision

      refreshSessionPromise = (async () => {
        const config = useRuntimeConfig()
        const apiBase = typeof config.public.apiBase === 'string' ? config.public.apiBase : ''
        try {
          if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Offline')
          const tokens = await $fetch<{ access_token: string, refresh_token: string, token_type: string }>(
            '/backoffice/auth/refresh',
            {
              baseURL: apiBase,
              method: 'POST',
              cache: 'no-store',
              retry: 0,
              body: { refresh_token: refreshToken },
            },
          )
          if (!current()) return false
          this.accessToken = tokens.access_token
          this.refreshToken = tokens.refresh_token
          return true
        }
        catch (cause: any) {
          if (!current()) return false
          if (cause?.response?.status !== 401 && cause?.response?.status !== 403) throw cause
          if (current()) this.clearSession()
          return false
        }
        finally {
          if (refreshSessionRevision === revision) refreshSessionPromise = null
        }
      })()

      return refreshSessionPromise
    },
    clearSession() {
      this.sessionRevision++
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

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: '',
    user: null as null | {
      id: number
      email: string
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
      this.user = await api.me()
      this.initialized = true
    },
    async init() {
      if (this.initialized) return
      this.initialized = true
      if (!this.accessToken) return
      try {
        const api = useBackofficeApi()
        this.user = await api.me()
      }
      catch {
        this.logout()
      }
    },
    logout() {
      this.accessToken = ''
      this.user = null
      if (process.client) {
        localStorage.removeItem('backoffice-auth')
      }
      return navigateTo('/login')
    },
  },
})

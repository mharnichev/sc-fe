import type {
  CustomerAuthResponseDto,
  CustomerOtpRequestResponseDto,
  ShopCustomerDto,
} from '@shared-types'

interface CustomerAuthState {
  accessToken: string
  tokenType: string
  customer: ShopCustomerDto | null
  loading: boolean
  error: string
  sessionRevision: number
}

type CustomerProfilePatch = Partial<Pick<ShopCustomerDto, 'email' | 'name' | 'surname' | 'birthday' | 'notes'>>

const currentCustomerSession = (state: CustomerAuthState) => {
  const { accessToken, tokenType, sessionRevision } = state
  const customerId = state.customer?.id
  return () => state.accessToken === accessToken && state.tokenType === tokenType
    && state.sessionRevision === sessionRevision && state.customer?.id === customerId
}

const captureCustomerSession = (state: CustomerAuthState) => {
  const isCurrentSession = currentCustomerSession(state)
  return () => {
    if (!isCurrentSession()) {
      throw Object.assign(new Error('Customer session changed. Sign in again.'), {
        name: 'ObsoleteCustomerSessionError', statusCode: 401,
      })
    }
  }
}

export const useCustomerAuthStore = defineStore('customer-auth', {
  state: (): CustomerAuthState => ({
    accessToken: '',
    tokenType: 'Bearer',
    customer: null,
    loading: false,
    error: '',
    sessionRevision: 0,
  }),
  getters: {
    isAuthenticated: state => Boolean(state.accessToken && state.customer),
    displayName: state => {
      const name = [state.customer?.name, state.customer?.surname].filter(Boolean).join(' ').trim()
      return name || state.customer?.phone || 'Customer'
    },
  },
  actions: {
    captureSession() {
      return currentCustomerSession(this)
    },
    prepareAccountState(preserveGuest = false) {
      const scope = this.isAuthenticated ? `customer:${this.customer!.id}` : 'guest'
      useCartStore().prepareSession(scope, preserveGuest)
      useFavoritesStore().prepareSession(scope, preserveGuest)
    },
    hydrate(snapshot: Partial<CustomerAuthState>) {
      this.sessionRevision++
      this.accessToken = snapshot.accessToken || ''
      this.tokenType = snapshot.tokenType || 'Bearer'
      this.customer = snapshot.customer || null
      this.loading = false
      this.prepareAccountState()
    },
    setSession(response: CustomerAuthResponseDto) {
      this.sessionRevision++
      this.accessToken = response.access_token
      this.tokenType = response.token_type || 'Bearer'
      this.customer = response.customer
      this.loading = false
      this.prepareAccountState(true)
    },
    async requestOtp(phone: string) {
      const isCurrentSession = this.captureSession()
      this.loading = true
      this.error = ''
      try {
        const api = useApi()
        return await api<CustomerOtpRequestResponseDto>('/public/customers/auth/request-otp', {
          method: 'POST',
          body: { phone },
        })
      }
      catch (error) {
        if (isCurrentSession()) this.error = 'Could not send OTP code.'
        throw error
      }
      finally {
        if (isCurrentSession()) this.loading = false
      }
    },
    async verifyOtp(phone: string, otpCode: string) {
      let isCurrentSession = this.captureSession()
      const assertCurrentSession = captureCustomerSession(this)
      this.loading = true
      this.error = ''
      try {
        const api = useApi()
        const response = await api<CustomerAuthResponseDto>('/public/customers/auth/verify-otp', {
          method: 'POST',
          body: { phone, otp_code: otpCode },
        })
        assertCurrentSession()
        this.setSession(response)
        isCurrentSession = this.captureSession()
        const assertAuthenticatedSession = captureCustomerSession(this)
        this.loading = true

        const cart = useCartStore()
        const favorites = useFavoritesStore()
        await Promise.allSettled([
          cart.mergeAnonymousIntoServer(),
          favorites.mergeAnonymousIntoServer(),
        ])
        assertAuthenticatedSession()

        return response
      }
      catch (error) {
        if (isCurrentSession()) this.error = 'Could not verify OTP code.'
        throw error
      }
      finally {
        if (isCurrentSession()) this.loading = false
      }
    },
    async fetchMe() {
      if (!this.accessToken) return null
      const assertCurrentSession = captureCustomerSession(this)

      try {
        const api = useApi()
        const customer = await api<ShopCustomerDto>('/public/customers/me')
        assertCurrentSession()
        this.customer = customer
        return this.customer
      }
      catch (error) {
        assertCurrentSession()
        this.logout()
        throw error
      }
    },
    async updateProfile(body: CustomerProfilePatch) {
      const assertCurrentSession = captureCustomerSession(this)
      const api = useApi()
      const { email, name, surname, birthday, notes } = body
      const customer = await api<ShopCustomerDto>('/public/customers/me', {
        method: 'PATCH',
        body: { email, name, surname, birthday, notes },
      }).finally(assertCurrentSession)
      assertCurrentSession()
      this.customer = customer
      return this.customer
    },
    async requestPhoneChange(phone: string) {
      const assertCurrentSession = captureCustomerSession(this)
      const response = await useApi()<CustomerOtpRequestResponseDto>('/public/customers/me/phone-change/request-otp', {
        method: 'POST',
        body: { phone },
      }).finally(assertCurrentSession)
      assertCurrentSession()
      return response
    },
    async confirmPhoneChange(phone: string, otpCode: string) {
      const assertCurrentSession = captureCustomerSession(this)
      const customer = await useApi()<ShopCustomerDto>('/public/customers/me/phone-change/confirm', {
        method: 'POST',
        body: { phone, otp_code: otpCode },
      }).finally(assertCurrentSession)
      assertCurrentSession()
      // The backend retains this JWT; confirmation returns a customer, not a session.
      this.customer = customer
      return customer
    },
    logout() {
      this.sessionRevision++
      this.accessToken = ''
      this.tokenType = 'Bearer'
      this.customer = null
      this.loading = false
      this.error = ''
      this.prepareAccountState()
    },
  },
})

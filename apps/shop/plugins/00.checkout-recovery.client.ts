import { isRecoveryPath, takeRecoveryToken } from '~/utils/checkoutReminder'

export default defineNuxtPlugin({
  name: 'checkout-recovery-privacy',
  enforce: 'pre',
  setup() {
    const config = useRuntimeConfig()
    const router = useRouter()
    const tokenState = useState<string>('checkout-recovery-token', () => '')
    const carrier = window as Window & { __scCheckoutRecoveryToken?: string }
    if (isRecoveryPath(window.location.pathname, config.app.baseURL)) {
      tokenState.value = carrier.__scCheckoutRecoveryToken || takeRecoveryToken(window.location, window.history)
    }
    delete carrier.__scCheckoutRecoveryToken
    const removeGuard = router.beforeEach(to => {
      // Router paths are relative to app.baseURL; strip before later integrations see navigation.
      if (!isRecoveryPath(to.path)) return
      if (!to.hash && !Object.keys(to.query).length) return
      tokenState.value = takeRecoveryToken({ hash: to.hash, pathname: to.path, search: '' }, { replaceState: () => {} })
      return { path: to.path, query: {}, hash: '', replace: true }
    })
    if (import.meta.hot) import.meta.hot.dispose(removeGuard)
  },
})

export default defineNuxtPlugin({
  name: 'payment-resume-privacy',
  enforce: 'pre',
  setup() {
    const router = useRouter()
    const { app: { baseURL } } = useRuntimeConfig()
    const resume = useState<{ id: number, token: string } | null>('shop-payment-resume', () => null)
    const orderId = (path: string) => {
      const match = /^\/payment\/([1-9]\d*)\/?$/.exec(path)
      const id = Number(match?.[1])
      return Number.isSafeInteger(id) && id > 0 ? id : null
    }
    const take = (id: number, hash: string) => {
      const token = new URLSearchParams(hash.slice(1)).get('token') || ''
      resume.value = token.length <= 2048 && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)
        ? { id, token }
        : null
    }

    const { pathname, hash, search } = window.location
    const base = baseURL.replace(/\/$/, '')
    const initialId = pathname.startsWith(`${base}/`) ? orderId(pathname.slice(base.length)) : null
    if (initialId && (hash || search)) {
      window.history.replaceState(window.history.state, '', pathname)
      take(initialId, hash)
    }

    const removeGuard = router.beforeEach(to => {
      const id = orderId(to.path)
      if (!id || (!to.hash && !Object.keys(to.query).length)) return
      if (to.hash) take(id, to.hash)
      return { path: to.path, query: {}, hash: '', replace: true }
    })
    if (import.meta.hot) import.meta.hot.dispose(removeGuard)
  },
})

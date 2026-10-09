interface BlogSubscriptionResponse {
  email: string
  status: 'subscribed' | 'unsubscribed'
  is_subscribed: boolean
  subscribed_at: string | null
  unsubscribed_at: string | null
}

interface BlogUnsubscribePayload {
  email?: string
  token: string
  reason?: string
}

const firstQueryValue = (value: unknown) => Array.isArray(value) ? value[0] : value
const optionalQueryString = (value: unknown) => {
  const normalizedValue = firstQueryValue(value)

  return typeof normalizedValue === 'string' && normalizedValue.trim() ? normalizedValue : undefined
}

// Per-app, memory-only proof survives URL cleanup without SSR payload or storage.
const capabilities = new WeakMap<object, { path: string, token?: string, confirmation?: string }>()

export const useBlogSubscription = () => {
  const api = useBlogApi()
  const route = useRoute()
  const router = useRouter()
  const app = useNuxtApp()
  const { locale, terms } = useBlogLocale()
  let capability = capabilities.get(app)
  const incomingToken = optionalQueryString(route.query.token)
  const incomingConfirmation = optionalQueryString(route.query.confirmation_token)
  if (!capability || capability.path !== route.path || incomingToken || incomingConfirmation) {
    capability = { path: route.path, token: incomingToken, confirmation: incomingConfirmation }
    capabilities.set(app, capability)
  }
  // Capabilities are only sent in dedicated request fields, never attribution.
  const unsubscribeToken = capability.token || ''
  const confirmationToken = computed(() => capability.confirmation
    || (capability.path === '/newsletter/unsubscribe' ? capability.token : undefined))
  useHead({ meta: [
    { name: 'referrer', content: 'no-referrer' },
    ...(unsubscribeToken || confirmationToken.value ? [{ name: 'robots', content: 'noindex,nofollow' }] : []),
  ] })
  onMounted(() => {
    if (!unsubscribeToken && !confirmationToken.value) return
    window.history.replaceState(window.history.state, '', route.path)
    void router.replace({ path: route.path, query: {}, hash: '' })
  })

  const subscriptionError = (error: unknown) => {
    const failure = error as { statusCode?: number, status?: number }
    return (failure.statusCode || failure.status) === 403
      ? terms.value.subscriptionProofRequired
      : terms.value.subscriptionError
  }

  const subscribeToBlog = (email: string, source = 'blog', proof = confirmationToken.value) =>
    api<BlogSubscriptionResponse>('/public/blog/subscribe', {
      method: 'POST',
      body: {
        email: email.trim(),
        source,
        language: locale.value,
        confirmation_token: proof,
        referrer: route.path,
        utm_source: proof ? undefined : optionalQueryString(route.query.utm_source),
        utm_medium: proof ? undefined : optionalQueryString(route.query.utm_medium),
        utm_campaign: proof ? undefined : optionalQueryString(route.query.utm_campaign),
        metadata_json: {
          path: route.path,
        },
      },
    })

  const unsubscribeFromBlog = (payload: BlogUnsubscribePayload) => {
    if (!payload.token?.trim()) return Promise.reject(new Error('Personal unsubscribe token required'))
    return api<BlogSubscriptionResponse>('/public/blog/unsubscribe', {
      method: 'POST',
      body: { token: payload.token, email: payload.email?.trim() || undefined, reason: payload.reason },
    })
  }

  return {
    subscribeToBlog,
    unsubscribeFromBlog,
    subscriptionError,
    confirmationToken,
    unsubscribeToken,
  }
}

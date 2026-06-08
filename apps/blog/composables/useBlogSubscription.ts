interface BlogSubscriptionResponse {
  email: string
  status: 'subscribed' | 'unsubscribed'
  is_subscribed: boolean
  subscribed_at: string | null
  unsubscribed_at: string | null
  unsubscribe_token: string
}

interface BlogUnsubscribePayload {
  email?: string
  token?: string
  reason?: string
}

const firstQueryValue = (value: unknown) => Array.isArray(value) ? value[0] : value
const optionalQueryString = (value: unknown) => {
  const normalizedValue = firstQueryValue(value)

  return typeof normalizedValue === 'string' && normalizedValue.trim() ? normalizedValue : undefined
}

export const useBlogSubscription = () => {
  const api = useBlogApi()
  const route = useRoute()
  const { locale } = useBlogLocale()

  const subscribeToBlog = (email: string, source = 'blog') =>
    api<BlogSubscriptionResponse>('/public/blog/subscribe', {
      method: 'POST',
      body: {
        email: email.trim(),
        source,
        language: locale.value,
        referrer: import.meta.client ? window.location.href : route.fullPath,
        utm_source: optionalQueryString(route.query.utm_source),
        utm_medium: optionalQueryString(route.query.utm_medium),
        utm_campaign: optionalQueryString(route.query.utm_campaign),
        metadata_json: {
          path: route.path,
        },
      },
    })

  const unsubscribeFromBlog = (payload: BlogUnsubscribePayload) =>
    api<BlogSubscriptionResponse>('/public/blog/unsubscribe', {
      method: 'POST',
      body: payload,
    })

  return {
    subscribeToBlog,
    unsubscribeFromBlog,
  }
}

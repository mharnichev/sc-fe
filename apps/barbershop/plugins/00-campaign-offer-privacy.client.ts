import { clearCampaignOffer, isCampaignOfferToken, saveCampaignOffer } from '~/utils/campaignOffer'

export default defineNuxtPlugin({
  name: 'campaign-offer-privacy',
  enforce: 'pre',
  setup() {
    const router = useRouter()
    const capturedToken = useState<string | null>('campaign-offer-captured-token', () => null)
    const isBooking = (path: string) => path === '/booking' || path === '/booking/'
    const capture = (path: string, query: Record<string, unknown>) => {
      if (!isBooking(path) || !Object.hasOwn(query, 'offer_token')) return false
      const token = query.offer_token
      capturedToken.value = isCampaignOfferToken(token) ? token : ''
      try {
        if (isCampaignOfferToken(token)) saveCampaignOffer(window.sessionStorage, token)
        else clearCampaignOffer(window.sessionStorage)
      }
      catch { /* Private storage may be unavailable. The booking page handles this case. */ }
      return true
    }

    const current = new URL(window.location.href)
    if (capture(current.pathname, Object.fromEntries(current.searchParams))) {
      current.searchParams.delete('offer_token')
      window.history.replaceState(window.history.state, '', `${current.pathname}${current.search}${current.hash}`)
    }

    router.beforeEach((to) => {
      if (!capture(to.path, to.query)) return
      const query = { ...to.query }
      delete query.offer_token
      return { path: to.path, query, hash: to.hash, replace: true }
    })
  },
})

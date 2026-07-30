import {
  isTokenizedReviewLocation,
  reviewTokenFromHash,
} from '~/utils/reviews.js'

export default defineNuxtPlugin({
  name: 'review-token-privacy',
  enforce: 'pre',
  setup() {
    const router = useRouter()
    const { reviewToken, isPrivateReviewRoute } = useReviewPrivacy()

    const captureReviewToken = (pathname: string, hash: string) => {
      if (!isTokenizedReviewLocation(pathname, hash)) return false

      const token = reviewTokenFromHash(hash)
      if (!token) return false

      reviewToken.value = token
      isPrivateReviewRoute.value = true
      return true
    }

    if (captureReviewToken(window.location.pathname, window.location.hash)) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`,
      )
    }

    router.beforeEach((to) => {
      if (captureReviewToken(to.path, to.hash)) {
        return {
          path: to.path,
          query: to.query,
          hash: '',
          replace: true,
        }
      }

      isPrivateReviewRoute.value = Boolean(
        reviewToken.value
        && (to.path === '/masters' || to.path === '/masters/'),
      )
    })
  },
})

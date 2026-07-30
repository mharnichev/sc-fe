export const useReviewPrivacy = () => {
  const reviewToken = useState<string>('private-review-token', () => '')
  const isPrivateReviewRoute = useState<boolean>('private-review-route', () => false)

  const clearPrivateReview = () => {
    reviewToken.value = ''
    isPrivateReviewRoute.value = false
  }

  return {
    reviewToken,
    isPrivateReviewRoute,
    clearPrivateReview,
  }
}

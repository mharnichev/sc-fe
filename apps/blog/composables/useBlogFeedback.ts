interface BlogFeedbackPayload {
  name: string
  email: string
  text: string
}

interface BlogFeedbackResponse {
  message: string
}

export const useBlogFeedback = () => {
  const api = useBlogApi()

  const sendFeedback = (payload: BlogFeedbackPayload) =>
    api<BlogFeedbackResponse>('/public/feedback/email', {
      method: 'POST',
      body: payload,
    })

  return {
    sendFeedback,
  }
}

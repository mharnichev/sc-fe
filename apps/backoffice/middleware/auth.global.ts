export default defineNuxtRouteMiddleware(async to => {
  const auth = useAuthStore()
  await auth.init()

  if (to.path === '/login') {
    if (auth.accessToken && auth.user) {
      return navigateTo('/')
    }
    return
  }
  if (!auth.accessToken) {
    return navigateTo('/login')
  }
  if (!auth.user) {
    return navigateTo('/login')
  }
  if ((to.path.startsWith('/messaging') || to.path.startsWith('/blog')) && !(auth.user.is_superuser || auth.user.role === 'admin')) {
    return navigateTo('/')
  }
})

import type { RouteLocationNormalized } from 'vue-router'

const safeRedirectPath = (value: unknown) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'

const loginRedirect = (to: RouteLocationNormalized) => ({
  path: '/login',
  query: to.fullPath && to.fullPath !== '/login' ? { redirect: to.fullPath } : undefined,
})

export default defineNuxtRouteMiddleware(async to => {
  const auth = useAuthStore()
  await auth.init()

  if (to.path === '/login') {
    if (auth.accessToken && auth.user) {
      return navigateTo(safeRedirectPath(to.query.redirect))
    }
    return
  }
  if (!auth.accessToken) {
    return navigateTo(loginRedirect(to))
  }
  if (!auth.user) {
    return navigateTo(loginRedirect(to))
  }
  if ((to.path.startsWith('/messaging') || to.path.startsWith('/blog') || to.path.startsWith('/reviews')) && !(auth.user.is_superuser || auth.user.role === 'admin')) {
    return navigateTo('/')
  }
})

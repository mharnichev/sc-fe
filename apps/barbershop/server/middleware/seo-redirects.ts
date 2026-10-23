// Retired tariff URLs remain permanent entry points; historical records and
// backend IDs are retained. Preserve query parameters used by booking links.
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const retiredPath = '/services/clipper-cut-beard-trim-ukrainian-armed-forces-15'
  const base = url.pathname.replace(/^\/en(?=\/|$)/, '').replace(/\/+$/, '')
  if (base === retiredPath) {
    const prefix = url.pathname.startsWith('/en/') ? '/en' : ''
    return sendRedirect(event, `${prefix}/services/clipper-cut-beard-trim-3${url.search}`, 301)
  }
  if (url.pathname === '/en') return sendRedirect(event, `/en/${url.search}`, 301)
})

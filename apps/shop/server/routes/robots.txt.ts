export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'X-Robots-Tag', 'noindex, nofollow, noarchive')
  return 'User-agent: *\nDisallow: /shop/\n'
})

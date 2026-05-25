const routes = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/services', priority: '0.8', changefreq: 'weekly' },
  { loc: '/masters', priority: '0.8', changefreq: 'weekly' },
  { loc: '/contacts', priority: '0.8', changefreq: 'monthly' },
  { loc: '/about', priority: '0.6', changefreq: 'monthly' },
  { loc: '/blog-faq', priority: '0.6', changefreq: 'monthly' },
]

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl || '').replace(/\/+$/, '')
  const today = new Date().toISOString().slice(0, 10)

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')

  const body = routes.map(route => [
    '  <url>',
    `    <loc>${xmlEscape(`${siteUrl}${route.loc}`)}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    `    <changefreq>${route.changefreq}</changefreq>`,
    `    <priority>${route.priority}</priority>`,
    '  </url>',
  ].join('\n')).join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
    '',
  ].join('\n')
})

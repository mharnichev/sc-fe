import { isIndexableBlogPost, postMetadata } from '../../data/postMetadata'

const xmlEscape = (value: string) => value
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const postDate = (value: string, now: number) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().startsWith(value) && timestamp <= now
    ? value
    : null
}

export const blogSitemapXml = (siteUrl: string, now = Date.now()) => {
  const configured = new URL(siteUrl)
  if (!['http:', 'https:'].includes(configured.protocol) || configured.username || configured.password || configured.search || configured.hash || configured.pathname.replace(/\/+$/, '') !== '/blog') {
    throw new Error('Invalid blog sitemap site URL')
  }
  const base = `${configured.origin}/blog`
  const urls: Array<{ loc: string, lastmod?: string }> = [
    { loc: `${base}/` },
    { loc: `${base}/posts` },
    { loc: `${base}/about` },
    { loc: `${base}/contacts` },
    { loc: `${base}/terms` },
    ...Object.values(postMetadata).filter(isIndexableBlogPost).flatMap((post) => {
      const publishedAt = postDate(post.publishedAt, now)
      return publishedAt && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)
        ? [{ loc: `${base}/posts/${post.slug}`, lastmod: publishedAt }]
        : []
    }),
  ]

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(({ loc, lastmod }) => [
      '  <url>',
      `    <loc>${xmlEscape(loc)}</loc>`,
      ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
      '  </url>',
    ].join('\n')),
    '</urlset>',
    '',
  ].join('\n')
}

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=900')
  return blogSitemapXml(String(config.public.siteUrl || ''))
})


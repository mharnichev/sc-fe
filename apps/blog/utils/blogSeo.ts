import type { LocalizedBlogPost } from '../data/posts'
import type { LocaleCode } from '../data/locale'

// Production serves the journal at /blog, even when the shared site URL is an origin.
export const blogBaseUrl = (siteUrl: string) => {
  const configured = new URL(siteUrl)
  if (!['http:', 'https:'].includes(configured.protocol) || configured.username || configured.password || configured.search || configured.hash || !['', '/blog'].includes(configured.pathname.replace(/\/+$/, ''))) {
    throw new Error('Invalid blog site URL')
  }
  return `${configured.origin}/blog`
}

export const blogCanonicalUrl = (siteUrl: string, path = '/') => {
  const base = blogBaseUrl(siteUrl)
  // Route queries (including tracking parameters) never form part of a canonical.
  const pathname = path.split(/[?#]/, 1)[0] || '/'
  return `${base}/${pathname.replace(/^\/+|\/+$/g, '')}`
}

export const blogImageUrl = (siteUrl: string, image: string) => new URL(image, `${blogBaseUrl(siteUrl)}/`).toString()

export const blogArticleSchema = (siteUrl: string, post: LocalizedBlogPost, locale: LocaleCode) => {
  const url = blogCanonicalUrl(siteUrl, `/posts/${post.slug}`)
  const publisher = {
    '@type': 'Organization',
    name: 'Soul Cuts',
    url: new URL(blogBaseUrl(siteUrl)).origin + '/',
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: post.title,
    description: post.excerpt,
    image: [blogImageUrl(siteUrl, post.coverImage)],
    datePublished: post.publishedAt,
    // No dateModified is claimed: the content source records publication dates only.
    author: {
      '@type': post.authorType,
      name: post.author,
      ...(post.authorType === 'Organization' ? { url: publisher.url } : {}),
    },
    publisher,
    inLanguage: locale === 'uk' ? 'uk-UA' : 'en',
    articleSection: post.category,
    isPartOf: {
      '@type': 'Blog',
      name: 'Soulcuts Journal',
      url: blogCanonicalUrl(siteUrl),
    },
  }
}

// Keep inline JSON parseable without allowing text to terminate its script element.
export const serializeBlogJsonLd = (value: unknown) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029')

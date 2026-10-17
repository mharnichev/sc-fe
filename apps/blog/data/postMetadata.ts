export type BlogPostVisibility = 'public' | 'unlisted'

export interface BlogPostMetadata {
  slug: string
  publishedAt: string
  visibility?: BlogPostVisibility
}

export const postMetadata = {
  historyOfIdemNaBukvy: {
    slug: 'history-of-idem-na-bukvy',
    publishedAt: '2026-07-14',
  },
  barberingInTheMuseum: {
    slug: 'barbering-in-the-museum',
    publishedAt: '2026-03-16',
  },
} satisfies Record<string, BlogPostMetadata>

export const isIndexableBlogPost = (post: BlogPostMetadata) => post.visibility !== 'unlisted'


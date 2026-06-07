export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  publishedAt: string
  category: string
  author: string
  readMinutes: number
  coverImage: string
  coverImageAlt: string
  featured?: boolean
  articleImages?: Array<{
    afterParagraphIndex: number
    src: string
    alt: string
    caption?: string
  }>
  content: string[]
}

export interface FeaturedCategory {
  title: string
  description: string
  accentClass: string
}

export const posts: BlogPost[] = [
  {
    slug: 'inside-the-modern-neighborhood-studio',
    title: 'Inside the Modern Neighborhood Studio',
    excerpt: 'How independent creative spaces are turning local scenes into sharper, more useful communities.',
    publishedAt: '2026-05-28',
    category: 'Culture',
    author: 'Marta Kovalenko',
    readMinutes: 6,
    coverImage: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80',
    coverImageAlt: 'Creative studio workspace with desks and warm light',
    featured: true,
    articleImages: [
      {
        afterParagraphIndex: 1,
        src: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1400&q=80',
        alt: 'Audience gathered in a small creative venue with warm stage light',
        caption: 'Small rooms turn casual visits into shared reference points for the people who keep returning.',
      },
      {
        afterParagraphIndex: 5,
        src: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1400&q=80',
        alt: 'Creative team working around a long table with laptops and notebooks',
        caption: 'The strongest studios make production, conversation, and public programming feel like one rhythm.',
      },
    ],
    content: [
      'The best neighborhood studios now work like small publishing rooms, listening posts, and gathering spaces at the same time. They give artists a place to make work, but they also give a city a way to notice itself.',
      'That shift is less about aesthetics than rhythm. A strong studio has a calendar, a point of view, and enough public-facing activity to turn private experiments into shared reference points.',
      'Walk into one on a Thursday night and the boundaries are usually blurred. Someone is checking a lighting setup in the corner, a photographer is editing selects at the table, and a few regulars are comparing notes from the last opening. The work is not hidden away from the social life of the room; it is shaped by it.',
      'That public rhythm matters because it gives people a reason to return before anything is finished. A draft reading, a listening session, or a tiny exhibition can become a checkpoint. The studio is no longer only a place where outcomes are presented. It becomes a place where process is visible enough to invite trust.',
      'For emerging writers, stylists, photographers, and musicians, these spaces can become the first place where informal work starts to feel legible. The audience is close enough to be honest and small enough to stay generous.',
      'The best operators understand that generosity needs structure. They keep the calendar light enough to breathe, but consistent enough that people know when to show up. They document the room, publish recaps, and make small archives that help each event become part of a longer story.',
      'There is also a practical advantage. Neighborhood studios can move faster than institutions because their feedback loop is short. If a format feels stiff, it can change next week. If a collaboration works, it can become a recurring column, a workshop, or a printed object without passing through months of approval.',
      'That speed does not mean the work is disposable. In fact, the opposite is often true. Because the room is small, details carry more weight: the order of images on a wall, the way a host introduces a guest, the decision to keep a conversation off-mic until it is ready.',
      'The result is a scene that does not need to wait for permission from a larger platform. It can publish, document, host, and revise in public, building trust one useful event at a time.',
      'For an online magazine, that makes these studios more than a subject. They are a model for editorial life: specific, recurring, close to the people being covered, and willing to let the archive grow from repeated contact rather than from a single perfect launch.',
    ],
  },
  {
    slug: 'why-good-editorial-calendars-feel-human',
    title: 'Why Good Editorial Calendars Feel Human',
    excerpt: 'A practical look at pacing, recurring columns, and how small teams can publish without burning out.',
    publishedAt: '2026-05-24',
    category: 'Editorial',
    author: 'Ivan Chernenko',
    readMinutes: 5,
    coverImage: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1600&q=80',
    coverImageAlt: 'Notebook with planning notes on a desk',
    content: [
      'A calendar becomes useful when it protects attention instead of simply filling boxes. The strongest small publications build repeatable formats that make space for timely work without making every week feel improvised.',
      'Recurring columns help readers learn how to return. They also reduce decision fatigue for editors because the format already answers questions about scope, length, and tone.',
      'The human part is the margin. A durable calendar leaves enough room for interviews that run long, photo edits that need another pass, and stories that become clearer after one more conversation.',
    ],
  },
  {
    slug: 'the-return-of-the-city-guide',
    title: 'The Return of the City Guide',
    excerpt: 'Digital city guides are becoming smaller, sharper, and more personal than the old directory model.',
    publishedAt: '2026-05-18',
    category: 'Cities',
    author: 'Nika Melnyk',
    readMinutes: 4,
    coverImage: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1600&q=80',
    coverImageAlt: 'Dense city street at night with glowing windows',
    content: [
      'The most useful city guides no longer try to list everything. They behave more like a trusted friend with taste, context, and a willingness to explain why a place matters.',
      'That narrower editorial stance is a feature. Readers do not need another infinite map; they need a route through the noise and a reason to care about the stops along the way.',
      'For publishers, the opportunity is to connect practical recommendations with reporting. A guide can point to a cafe, but it can also tell the story of the people who made it important.',
    ],
  },
  {
    slug: 'small-venues-big-memory',
    title: 'Small Venues, Big Memory',
    excerpt: 'Why intimate rooms still define how people remember performances, scenes, and whole periods of taste.',
    publishedAt: '2026-05-10',
    category: 'Music',
    author: 'Oleh Savchuk',
    readMinutes: 7,
    coverImage: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1600&q=80',
    coverImageAlt: 'Performer singing into a microphone on a small stage',
    content: [
      'Small venues compress the distance between a performance and its consequences. The room is close enough for every mistake, joke, and surprise to become part of the record.',
      'That intimacy is why these places keep shaping memory long after their capacities suggest they should. A tiny show can become a citywide reference because the people who were there tell the story with unusual detail.',
      'For a magazine, those rooms are natural reporting ground. They show taste while it is still being argued over, before consensus flattens the edges.',
    ],
  },
  {
    slug: 'notes-on-building-a-better-archive',
    title: 'Notes on Building a Better Archive',
    excerpt: 'Archives become more valuable when they are designed for discovery, not just storage.',
    publishedAt: '2026-04-30',
    category: 'Process',
    author: 'Sofia Bondar',
    readMinutes: 5,
    coverImage: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1600&q=80',
    coverImageAlt: 'Rows of books and magazines on library shelves',
    content: [
      'An archive is not only a place where old work goes. For a growing publication, it is the system that lets readers understand what the publication has been paying attention to over time.',
      'Good archives expose patterns. They make it easy to trace a recurring question, a neighborhood, a collaborator, or a format without needing to remember the exact headline.',
      'The first version does not need to be complex. Clear categories, consistent metadata, and readable URLs already create a foundation that future tools can build on.',
    ],
  },
  {
    slug: 'a-field-guide-to-strong-interviews',
    title: 'A Field Guide to Strong Interviews',
    excerpt: 'The best interviews are structured enough to move and loose enough to let the guest surprise you.',
    publishedAt: '2026-04-22',
    category: 'Interviews',
    author: 'Danylo Hrytsenko',
    readMinutes: 6,
    coverImage: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1600&q=80',
    coverImageAlt: 'Two people speaking during a recorded interview',
    content: [
      'A strong interview starts before the recorder turns on. The preparation should identify what only this person can explain, then leave enough room for the conversation to move somewhere more specific.',
      'Questions work best when they create openings rather than performances. Short prompts, grounded follow-ups, and a willingness to wait often produce more useful answers than a heavily decorated setup.',
      'Editing matters too. A published interview should preserve the person without forcing readers through every detour that happened in the room.',
    ],
  },
]

export const sortedPosts = [...posts].sort((first, second) =>
  new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime(),
)

export const featuredPost: BlogPost = posts.find(post => post.featured) ?? sortedPosts[0]

export const latestPosts = sortedPosts.filter(post => post.slug !== featuredPost.slug)

export const featuredCategories: FeaturedCategory[] = [
  {
    title: 'Culture',
    description: 'Essays, scene notes, and perspective on the people shaping local creative life.',
    accentClass: 'bg-red-500',
  },
  {
    title: 'Music',
    description: 'Reviews, interviews, and short dispatches from rooms where new taste is forming.',
    accentClass: 'bg-sky-500',
  },
  {
    title: 'Cities',
    description: 'Guides and observations about places, habits, and the texture of everyday movement.',
    accentClass: 'bg-emerald-500',
  },
]

export const formatPostDate = (date: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))

export const getPostBySlug = (slug: string) => posts.find(post => post.slug === slug)

export const getRelatedPosts = (slug: string, limit = 3) => {
  const currentPost = getPostBySlug(slug)
  const relatedByCategory = sortedPosts.filter(post => post.slug !== slug && post.category === currentPost?.category)
  const fallback = sortedPosts.filter(post => post.slug !== slug && post.category !== currentPost?.category)

  return [...relatedByCategory, ...fallback].slice(0, limit)
}

export const SITEMAP_FRESH_MS = 15 * 60 * 1000
export const SITEMAP_MAX_STALE_MS = 24 * 60 * 60 * 1000
export const SITEMAP_UPSTREAM_TIMEOUT_MS = 5000

type Snapshot = { xml: string, fetchedAt: number }
export type SitemapResult = Snapshot & { freshness: 'fresh' | 'stale', error?: unknown }

export const createSitemapCache = (now: () => number = Date.now) => {
  const snapshots = new Map<string, Snapshot>()
  const pending = new Map<string, Promise<Snapshot>>()

  return async (key: string, build: () => Promise<string>): Promise<SitemapResult> => {
    const previous = snapshots.get(key)
    if (previous && now() - previous.fetchedAt < SITEMAP_FRESH_MS) {
      return { ...previous, freshness: 'fresh' }
    }

    let request = pending.get(key)
    if (!request) {
      request = Promise.resolve().then(build).then((xml) => {
        if (!xml.startsWith('<?xml') || !xml.includes('</urlset>')) {
          throw new Error('Sitemap builder returned invalid XML')
        }
        const snapshot = { xml, fetchedAt: now() }
        snapshots.set(key, snapshot)
        return snapshot
      })
      pending.set(key, request)
      void request.finally(() => {
        if (pending.get(key) === request) pending.delete(key)
      }).catch(() => {})
    }

    try {
      return { ...await request, freshness: 'fresh' }
    }
    catch (error) {
      const fallback = snapshots.get(key)
      if (fallback && now() - fallback.fetchedAt <= SITEMAP_MAX_STALE_MS) {
        return { ...fallback, freshness: 'stale', error }
      }
      throw error
    }
  }
}

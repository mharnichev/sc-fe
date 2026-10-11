import type { NuxtApp } from '#app'

export interface MasterTrustCache<T> {
  value: T
  fetchedAt: number
  cacheKey: string
}

export const MASTER_TRUST_CACHE_TTL = 60_000

export const readMasterTrustCache = <T>(
  cached: MasterTrustCache<T> | undefined,
  hydrating: boolean,
  cause: string,
  now = Date.now(),
): MasterTrustCache<T> | undefined => {
  if (cause === 'refresh:manual' || cause === 'refresh:hook') return undefined
  if (!cached || (!hydrating && now - cached.fetchedAt >= MASTER_TRUST_CACHE_TTL)) return undefined
  return cached
}

export const getMasterTrustCachedData = <T>(
  key: string,
  app: NuxtApp,
  context: { cause: string },
): MasterTrustCache<T> | undefined => readMasterTrustCache(
  app.payload.data[key] ?? app.static.data[key],
  Boolean(app.isHydrating),
  context.cause,
)

const pendingRequests = new WeakMap<object, Map<string, Promise<unknown>>>()

export const runMasterTrustRequest = <T>(
  app: object,
  key: string,
  load: () => Promise<T>,
): Promise<T> => {
  let requests = pendingRequests.get(app)
  if (!requests) {
    requests = new Map()
    pendingRequests.set(app, requests)
  }
  const pending = requests.get(key)
  if (pending) return pending as Promise<T>

  const request = Promise.resolve().then(load).finally(() => {
    requests.delete(key)
  })
  requests.set(key, request)
  return request
}

export const loadMasterTrustData = <T>(
  app: NuxtApp,
  key: string,
  load: () => Promise<T>,
): Promise<MasterTrustCache<T>> => runMasterTrustRequest(app, key, async () => {
  const cached = { value: await load(), fetchedAt: Date.now(), cacheKey: key }
  app.payload.data[key] = cached
  return cached
})

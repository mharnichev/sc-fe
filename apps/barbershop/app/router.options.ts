import type { RouterConfig } from '@nuxt/schema'

const opaqueCapabilityHash = (hash: string) =>
  /^#[A-Za-z0-9_-]{32,512}$/.test(hash)

export default <RouterConfig>{
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition

    // Capability fragments are credentials, not DOM anchors. In particular,
    // Vue Router must not include them in missing-anchor console warnings.
    if (opaqueCapabilityHash(to.hash)) return { left: 0, top: 0 }
    if (to.hash) return { el: to.hash }

    return { left: 0, top: 0 }
  },
}

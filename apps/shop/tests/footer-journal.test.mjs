import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
const require = createRequire(import.meta.url)
const nuxtRequire = createRequire(require.resolve('nuxt/package.json'))
const vue = await import(pathToFileURL(nuxtRequire.resolve('vue')).href)
const ufo = await import(pathToFileURL(nuxtRequire.resolve('ufo')).href)
const { createRouter, createMemoryHistory } = await import(pathToFileURL(nuxtRequire.resolve('vue-router')).href)

test('actual NuxtLink keeps journal at root /blog/ and other footer links under /shop/', () => {
  const footer = readFileSync(new URL('../components/base/BaseFooter.vue', import.meta.url), 'utf8')
  assert.match(footer, /<NuxtLink[^>]*:external="link\.external"/)
  assert.ok(footer.includes(':trailing-slash="link.external ? \'append\' : undefined"'))
  const context = vm.createContext({ ...vue, ...ufo,
    useShopLocale: () => ({ terms: { value: { common: { journal: 'Journal', catalog: 'Catalog', contact: 'Contact' }, support: { title: 'Policy' }, footer: {} } } }),
    useRouter: () => createRouter({ history: createMemoryHistory('/shop/'), routes: [] }),
    useRuntimeConfig: () => ({ app: { baseURL: '/shop/' } }),
    resolveComponent: () => 'RouterLink', nuxtLinkDefaults: {}, hashMode: false,
  })
  vm.runInContext(footer.split('<script setup lang="ts">')[1].split('</script>')[0] + '\nglobalThis.links = footerLinks.value', context)
  // Use the installed Nuxt implementation, replacing only its app-context imports.
  const linkSource = readFileSync(nuxtRequire.resolve('./dist/app/components/nuxt-link.js'), 'utf8')
    .replace(/^import .*\n/gm, '').replace('export function defineNuxtLink', 'function defineNuxtLink')
    .replace(/^export default .*$/m, '').replaceAll('import.meta.dev', 'false')
    .replaceAll('import.meta.client', 'false').replaceAll('import.meta.server', 'true')
  vm.runInContext(linkSource + '\nglobalThis.NuxtLink = defineNuxtLink({})', context)
  const hrefs = context.links.map(link => context.NuxtLink.useLink({ to: link.to, external: link.external, trailingSlash: link.external ? 'append' : undefined }).href.value)
  assert.deepEqual(Array.from(hrefs), ['/blog/', '/shop/catalog', '/shop/contacts', '/shop/delivery-payment'])
  assert.equal(context.links[0].external, true)
  assert.ok(context.links.slice(1).every(link => !link.external))
})

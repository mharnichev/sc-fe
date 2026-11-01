import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const runtime = createRequire(require.resolve('nuxt/package.json'))
const vue = await import(pathToFileURL(runtime.resolve('vue')).href)
const { parse } = runtime('@vue/compiler-sfc')
const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const source = read('components/HomeJournalSection.vue')

test('journal images retain the approved immutable snapshot bytes', () => {
  const hashes = {
    'barbering-museum.webp': '36f89c3c5b81aed4402aee1ea642dbfa9364025dd4c32949573478fcc07e0213',
    'bg-dark-1.png': '8a3ed843ce709ac06d2163437ba845fdcb1167b37068b7a726aefa8b4c378f1e',
    'idem-na-bukvy.webp': 'c66a5f3ffc2c616d39250c5be4c3d3eee1369d59c75ffe9596771e07c626a198',
  }
  for (const [name, expected] of Object.entries(hashes)) {
    const data = readFileSync(new URL(`assets/images/journal/${name}`, root))
    assert.equal(createHash('sha256').update(data).digest('hex'), expected)
    assert.match(source, new RegExp(`~/assets/images/journal/${name.replaceAll('.', '\\.')}`))
  }
})

test('journal copy changes UK/EN without changing stories, URLs or UTC dates', () => {
  const locale = vue.ref('uk')
  const script = parse(source).descriptor.scriptSetup.content.replace(/^import (\w+) from ['"]([^'"]+)['"]$/gm, (_, name, path) => `const ${name} = ${JSON.stringify(path)}`)
  const js = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const model = vm.runInNewContext(`${js}; ({ stories, copy, storyUrl, formatDate })`, { computed: vue.computed, useShopLocale: () => ({ locale }) })
  assert.equal(model.stories.length, 2)
  const before = JSON.stringify(model.stories)
  assert.equal(model.copy.value.read, 'Читати історію')
  assert.match(model.formatDate('2026-07-14'), /2026/)
  locale.value = 'en'
  assert.equal(model.copy.value.read, 'Read the story')
  assert.equal(model.formatDate('2026-07-14'), '14 July 2026')
  assert.equal(model.storyUrl(model.stories[0].slug), '/blog/posts/history-of-idem-na-bukvy/')
  assert.equal(model.storyUrl(model.stories[1].slug), '/blog/posts/barbering-in-the-museum/')
  assert.equal(JSON.stringify(model.stories), before)
  assert.doesNotMatch(source, /https:\/\/soulcuts\.com\.ua|\/shop\/blog|\bfetch\(|useApi\(/)
})

test('journal is a full-width home-only layout band without changing page safety or popular spacing', () => {
  const layout = read('layouts/default.vue')
  const home = read('pages/index.vue')
  assert.match(layout, /<HomeJournalSection v-if="route\.path === '\/'" class="home-journal-section"/)
  assert.match(layout, /<slot \/>\s*<\/div>\s*<HomeJournalSection/)
  assert.match(layout, /'site-container--home': route\.path === '\/'/)
  assert.match(layout, /\.site-container--home\s*\{\s*padding-bottom: 0/)
  assert.match(layout, /isHydrated && isPageTransitionVisible/)
  assert.match(home, /<div class="space-y-16">/)
  assert.match(home, /\.main-page__popular\s*\{[^}]*padding-bottom: 4rem/s)
  assert.match(read('nuxt.config.ts'), /noindex, nofollow, noarchive/)
  assert.match(read('components/catalog/CatalogCategoryLandingRoute.vue'), /fatal: true/)
  assert.doesNotMatch(source, /font-size:\s*clamp\([^)]*vw/)
})

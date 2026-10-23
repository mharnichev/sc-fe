import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const importTypeScript = async source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64')}`)
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const seo = await importTypeScript(await read('../utils/blogSeo.ts'))
const metadata = await importTypeScript(await read('../data/postMetadata.ts'))
globalThis.__blogSeoMetadata = metadata
const data = await importTypeScript((await read('../data/posts.ts'))
  .replace(/^import (\w+) from '(.+\.(?:jpg|webp|avif))'$/gm, (_, name, path) => `const ${name} = ${JSON.stringify(`/blog/_nuxt/${path.split('/').at(-1)}`)}`)
  .replace("import { isIndexableBlogPost, postMetadata } from './postMetadata'", 'const { isIndexableBlogPost, postMetadata } = globalThis.__blogSeoMetadata'))

// Execute each page's setup to verify the actual head it registers, including SSR
// reactivity. Asset imports stay mocked; delayed gallery loaders never run here.
const pageHead = async (page, { slug, locale = 'uk', siteUrl = 'https://soulcuts.com.ua' } = {}) => {
  const heads = []
  const seoMetas = []
  const language = { value: locale }
  const mocks = {
    ...seo,
    getPostBySlug: data.getPostBySlug,
    getRelatedPosts: data.getRelatedPosts,
    loadBlogPostImage: data.loadBlogPostImage,
    localizePost: data.localizePost,
    getFeaturedPost: data.getFeaturedPost,
    getLatestPosts: data.getLatestPosts,
    getLocalizedPosts: data.getLocalizedPosts,
    formatPostDate: data.formatPostDate,
    formatReadMinutes: data.formatReadMinutes,
    useRuntimeConfig: () => ({ public: { siteUrl } }),
    useBlogLocale: () => ({ locale: language, terms: { value: { contacts: {} } } }),
    useBlogAnalytics: () => ({ trackBlogEvent: () => {} }),
    useBlogFeedback: () => ({ sendFeedback: () => {} }),
    useRoute: () => ({ params: { slug }, path: `/posts/${slug}`, query: { utm_source: 'test' } }),
    computed: callback => ({ get value() { return callback() } }),
    ref: value => ({ value }),
    reactive: value => value,
    onMounted: () => {},
    onBeforeUnmount: () => {},
    useHead: head => heads.push(head),
    useSeoMeta: meta => seoMetas.push(meta),
    useResponseHeader: () => ({ value: undefined }),
    createError: error => Object.assign(new Error(error.statusMessage), error),
  }
  const source = (await read(`../pages/${page}`)).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*$/gm, '')
  const names = Object.keys(mocks)
  const compiled = ts.transpileModule(`const { ${names.join(', ')} } = mocks\n${source}`, {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function('mocks', compiled)(mocks)
  return {
    language,
    heads: () => heads.map(head => typeof head === 'function' ? head() : head),
    meta: () => Object.fromEntries(Object.entries(seoMetas.at(-1)).map(([key, value]) => [key, typeof value === 'function' ? value() : value])),
  }
}

for (const [page, path] of [['index.vue', '/'], ['posts/index.vue', '/posts'], ['contacts.vue', '/contacts']]) {
  test(`${page} registers exactly one clean /blog canonical from root or blog site configs`, async () => {
    for (const siteUrl of ['https://soulcuts.com.ua', 'https://soulcuts.com.ua/blog/']) {
      const actual = await pageHead(page, { siteUrl })
      const links = actual.heads().flatMap(head => head.link || []).filter(link => link.rel === 'canonical')
      assert.deepEqual(links, [{ rel: 'canonical', href: `https://soulcuts.com.ua/blog${path}` }])
    }
  })
}

test('canonical helpers remove query/fragment/trailing slash and reject unsafe base URLs', () => {
  assert.equal(seo.blogCanonicalUrl('https://soulcuts.com.ua/blog/', '/posts/?utm_source=x#top'), 'https://soulcuts.com.ua/blog/posts')
  for (const invalid of ['javascript:alert(1)', 'https://user:secret@example.com/blog', 'https://example.com/blog?tracking=1', 'https://example.com/private']) {
    assert.throws(() => seo.blogCanonicalUrl(invalid), /Invalid blog site URL/)
  }
})

for (const rawPost of data.posts) {
  test(`${rawPost.slug} renders real localized article schema and preserves hero priorities`, async () => {
    const actual = await pageHead('posts/[slug].vue', { slug: rawPost.slug })
    for (const locale of ['uk', 'en']) {
      actual.language.value = locale
      const post = data.localizePost(rawPost, locale)
      const heads = actual.heads()
      const scripts = heads.flatMap(head => head.script || [])
      assert.equal(scripts.length, 1)
      assert.equal(scripts[0].type, 'application/ld+json')
      const schema = JSON.parse(scripts[0].innerHTML)
      const url = `https://soulcuts.com.ua/blog/posts/${post.slug}`
      assert.equal(schema['@type'], 'BlogPosting')
      assert.equal(schema.headline, post.title)
      assert.equal(schema.description, post.excerpt)
      assert.equal(schema.datePublished, post.publishedAt)
      assert.equal(schema.dateModified, undefined)
      assert.equal(schema.author.name, post.author)
      assert.equal(schema.author['@type'], rawPost.slug === 'barbering-in-the-museum' ? 'Organization' : 'Person')
      assert.deepEqual(schema.publisher, { '@type': 'Organization', name: 'Soul Cuts', url: 'https://soulcuts.com.ua/' })
      assert.equal(schema.url, url)
      assert.equal(schema.mainEntityOfPage['@id'], url)
      assert.equal(schema.inLanguage, locale === 'uk' ? 'uk-UA' : 'en')
      assert.deepEqual(schema.image, [new URL(post.coverImage, 'https://soulcuts.com.ua/blog/').href])
      const links = heads.flatMap(head => head.link || [])
      assert.deepEqual(links.filter(link => link.rel === 'canonical'), [{ rel: 'canonical', href: url }])
      assert.equal(links.filter(link => link.rel === 'preload' && link.as === 'image' && link.fetchpriority === 'high').length, 2)
      assert.equal(actual.meta().ogUrl, url)
      assert.equal(actual.meta().ogImage, schema.image[0])
    }
  })
}

test('JSON-LD serialization round-trips hostile text without closing its script', () => {
  const payload = { headline: '</script><script>alert("x")</script> & >\u2028\u2029' }
  const serialized = seo.serializeBlogJsonLd(payload)
  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/)
  assert.deepEqual(JSON.parse(serialized), payload)
})

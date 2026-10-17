import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const toDataUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64')}`
const metadataSource = await readFile(new URL('../data/postMetadata.ts', import.meta.url), 'utf8')
const metadata = await import(toDataUrl(metadataSource))
globalThis.__blogSitemapMetadataMocks = metadata

const dataSource = (await readFile(new URL('../data/posts.ts', import.meta.url), 'utf8'))
  .replace(/^import (\w+) from '.+\.(?:jpg|webp)'$/gm, 'const $1 = "/image"')
  .replace("import { isIndexableBlogPost, postMetadata } from './postMetadata'", 'const { isIndexableBlogPost, postMetadata } = globalThis.__blogSitemapMetadataMocks')
const dataCompiled = ts.transpileModule(dataSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const data = await import(`data:text/javascript;base64,${Buffer.from(dataCompiled).toString('base64')}`)

globalThis.__blogSitemapRuntimeMocks = {
  isIndexableBlogPost: metadata.isIndexableBlogPost,
  postMetadata: {
    ...metadata.postMetadata,
    privateStory: { slug: 'private-story', publishedAt: '2026-01-01', visibility: 'unlisted' },
    futureStory: { slug: 'future-story', publishedAt: '2099-01-01' },
    badSlug: { slug: 'bad/slug', publishedAt: '2026-01-01' },
  },
  defineEventHandler: handler => handler,
  useRuntimeConfig: () => ({ public: { siteUrl: 'https://soulcuts.com.ua/blog' } }),
  setHeader: () => {},
}
const routeSource = `const { defineEventHandler, useRuntimeConfig, setHeader } = globalThis.__blogSitemapRuntimeMocks\n${(await readFile(new URL('../server/routes/sitemap.xml.ts', import.meta.url), 'utf8'))
  .replace("import { isIndexableBlogPost, postMetadata } from '../../data/postMetadata'", 'const { isIndexableBlogPost, postMetadata } = globalThis.__blogSitemapRuntimeMocks')}`
const routeCompiled = ts.transpileModule(routeSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { blogSitemapXml } = await import(`data:text/javascript;base64,${Buffer.from(routeCompiled).toString('base64')}`)

test('post pages and the sitemap share one publication metadata source', () => {
  const declared = Object.values(metadata.postMetadata)
  assert.deepEqual(
    data.posts.map(({ slug, publishedAt, visibility }) => ({ slug, publishedAt, visibility })),
    declared.map(({ slug, publishedAt, visibility }) => ({ slug, publishedAt, visibility })),
  )
  assert.deepEqual(
    data.getLocalizedPosts('en').map(post => post.slug).sort(),
    declared.filter(metadata.isIndexableBlogPost).map(post => post.slug).sort(),
  )
})

test('blog sitemap includes published public posts and excludes private, future, and unsafe URLs', () => {
  const xml = blogSitemapXml('https://soulcuts.com.ua/blog', Date.parse('2026-10-17'))
  assert.match(xml, /<loc>https:\/\/soulcuts\.com\.ua\/blog\/posts\/history-of-idem-na-bukvy<\/loc>/)
  assert.match(xml, /<loc>https:\/\/soulcuts\.com\.ua\/blog\/posts\/barbering-in-the-museum<\/loc>/)
  assert.match(xml, /<lastmod>2026-07-14<\/lastmod>/)
  assert.match(xml, /<loc>https:\/\/soulcuts\.com\.ua\/blog\/<\/loc>/)
  assert.doesNotMatch(xml, /private-story|future-story|bad\/slug|newsletter\/unsubscribe/)
  assert.equal((xml.match(/<loc>/g) || []).length, 7)
})

test('blog sitemap rejects an incorrect canonical base', () => {
  assert.throws(() => blogSitemapXml('https://other.example/blog?token=secret'), /Invalid blog sitemap site URL/)
  assert.throws(() => blogSitemapXml('https://other.example/private'), /Invalid blog sitemap site URL/)
})

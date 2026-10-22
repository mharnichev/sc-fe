import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url)
const nuxtRequire = createRequire(require.resolve('nuxt/package.json'))
const vue = await import(pathToFileURL(nuxtRequire.resolve('vue')).href)
const compiler = require(nuxtRequire.resolve('@vue/compiler-dom'))
const server = require(nuxtRequire.resolve('@vue/server-renderer'))
const source = await readFile(new URL('../pages/orders/[id].vue', import.meta.url), 'utf8')
const template = source.match(/<dl[^>]*data-testid="order-callback-preference"[^>]*>[\s\S]*?<\/dl>/)[0]
const render = new Function('Vue', compiler.compile(template, { mode: 'function' }).code)(vue)
test('team order view never interprets unknown historical callback as refusal', async () => {
 for (const [value, label] of [[true, 'Просить передзвонити для уточнення деталей'],[false, 'Дзвінок не запитано'],[null, 'Не вказано (історичний вибір невідомий)'],[undefined, 'Не вказано (історичний вибір невідомий)']]) {
  const html = await server.renderToString(vue.createSSRApp({ setup:()=>({order:{callback_requested:value}}), render }))
  assert.ok(html.includes(label), html)
 }
})

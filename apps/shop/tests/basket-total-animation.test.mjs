import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const nuxtRequire = createRequire(require.resolve('nuxt/package.json'))
const vue = nuxtRequire('vue')
const compiler = nuxtRequire('@vue/compiler-dom')
const server = nuxtRequire('@vue/server-renderer')
const source = await readFile(new URL('../components/modals/UserBasketModal.vue', import.meta.url), 'utf8')
const presentation = source.slice(source.indexOf('const totalDirection ='), source.indexOf('const isShow ='))
const script = ts.transpileModule(presentation, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const createPresentation = new Function('ref', 'computed', 'watch', 'cart', 'formatPrice', `${script}; return { totalDirection, formattedTotal, totalCharacters }`)
const markup = source.match(/<strong :aria-label="formattedTotal"[\s\S]*?<\/strong>/)?.[0]
assert.ok(markup, 'the real basket total must expose its formatted accessible label')
const render = new Function('Vue', compiler.compile(markup, { mode: 'function', prefixIdentifiers: true }).code)(vue)

test('basket total reacts in both directions without mutating cart arithmetic', async () => {
  const scope = vue.effectScope()
  const cart = vue.reactive({ total: 99.5 })
  const formatPrice = value => `${Number(value).toFixed(2)} ₴`
  const state = scope.run(() => createPresentation(vue.ref, vue.computed, vue.watch, cart, formatPrice))
  try {
    for (const [total, direction] of [[99.5, 'up'], [100, 'up'], [9.25, 'down'], [0, 'down'], [1234.56, 'up']]) {
      cart.total = total
      assert.equal(state.totalDirection.value, direction)
      assert.equal(state.formattedTotal.value, formatPrice(total))
      assert.equal(state.totalCharacters.value.map(part => part.character).join(''), formatPrice(total))
      assert.deepEqual(state.totalCharacters.value.map(part => part.place), Array.from({ length: formatPrice(total).length }, (_, index) => formatPrice(total).length - index))
      for (const part of state.totalCharacters.value) assert.equal(part.isDigit, /\d/.test(part.character))
      const html = await server.renderToString(vue.createSSRApp({ setup: () => state, render }))
      assert.ok(html.includes(`aria-label="${formatPrice(total)}" role="status"`), html)
      assert.ok(html.includes('class="basket-total-counter" aria-hidden="true"'), html)
      assert.equal(cart.total, total, 'presentation must not rewrite the authoritative total')
    }
  } finally { scope.stop() }
})

test('basket animation keys digits by place and uses the reactive direction', () => {
  assert.match(markup, /:key="part\.place"/)
  assert.match(markup, /:key="part\.character"/)
  assert.ok(markup.includes(':name="`basket-digit-${totalDirection}`"'))
  assert.match(source, /\.basket-total-counter__value\s*\{[^}]*grid-area: 1 \/ 1;/)
  assert.match(source, /\.basket-total-counter__character--digit\s*\{[^}]*width: 1ch;/)
})

test('reduced motion disables digit transitions without removing the readable total', () => {
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.basket-total-counter__value\s*\{\s*transition: none;/)
  assert.match(source, /\.basket-digit-up-enter-active,[\s\S]*?\.basket-digit-down-leave-active\s*\{\s*transition: transform/)
})

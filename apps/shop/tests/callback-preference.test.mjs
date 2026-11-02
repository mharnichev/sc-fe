import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { vue } from './runtime-localization-harness.mjs'
const require = createRequire(import.meta.url)
const nuxtRequire = createRequire(require.resolve('nuxt/package.json'))
const compiler = require(nuxtRequire.resolve('@vue/compiler-dom'))
const server = require(nuxtRequire.resolve('@vue/server-renderer'))
const source = await readFile(new URL('../components/OrderCallbackPreference.vue', import.meta.url), 'utf8')
const template = source.split('<template>')[1].split('</template>')[0]
const render = new Function('Vue', compiler.compile(template, { mode: 'function' }).code)(vue)
for (const locale of ['uk', 'en']) test(`${locale}: callback read view distinguishes request, no request, and unknown`, async () => {
 const expected = locale === 'uk' ? ['Передзвонити для уточнення деталей', 'Дзвінок не запитано', 'Не вказано'] : ['Callback requested to clarify details', 'No callback requested', 'Not specified']
 for (const [i, requested] of [true, false, null].entries()) {
  const app = vue.createSSRApp({ setup: () => ({ requested, locale }), render })
  const html = await server.renderToString(app)
  assert.ok(html.includes(expected[i]), html)
  for (let j=0;j<expected.length;j++) if(j!==i) assert.ok(!html.includes(expected[j]))
 }
})

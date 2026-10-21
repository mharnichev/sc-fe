import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../pages/znyzhka-dlia-zsu.vue', import.meta.url), 'utf8')
const footer = await readFile(new URL('../components/sections/Footer.vue', import.meta.url), 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]

test('military page provides both locales, matching FAQ data and safe booking links', () => {
  for (const locale of ['uk', 'en']) {
    let seo
    let faq
    const compiled = ts.transpileModule(script, {
      compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const run = new Function('useTerms', 'ref', 'computed', 'useSeo', 'useFaqStructuredData', `${compiled}\nreturn page.value`)
    const page = run(
      () => ({ locale: { value: locale }, terms: { value: { home: { contact: { address: 'Test address', phone: '+380 00' } } } } }),
      value => ({ value }),
      getter => ({ get value() { return getter() } }),
      (title, description, options) => { seo = { title: title(), description: description(), options } },
      getter => { faq = getter() },
    )
    assert.equal(seo.options.path, '/znyzhka-dlia-zsu')
    assert.equal(seo.title, page.title)
    assert.equal(seo.description, page.description)
    assert.deepEqual(faq, page.faq)
    assert.equal(faq.length, 5)
    assert.ok(faq.every(item => item.question.length > 10 && item.answer.length > 20))
    assert.match(faq.at(-1).answer, /Test address/)
    assert.equal(page.steps.length, 3)
    assert.ok(page.conditions.length > 80)
    assert.ok(page.heading.includes(locale === 'en' ? 'Ukrainian military' : 'ЗСУ'))
  }
  assert.equal((source.match(/to="\/#booking"/g) || []).length, 2)
  assert.doesNotMatch(source, /\$fetch|useFetch|defender=true|military=true/)
  assert.match(footer, /to="\/znyzhka-dlia-zsu"/)
  assert.match(footer, /Military discount/)
})
